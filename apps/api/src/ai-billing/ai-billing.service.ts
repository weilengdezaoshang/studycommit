import { and, eq, sql } from 'drizzle-orm'
import { Inject, Injectable } from '@nestjs/common'
import type { PaperExplainOutput } from '@studycommit/rpc-contracts/ai'
import { agentRuns, aiCostBudgets } from '../database/schema'
import {
  AI_BILLING_ERROR,
  AI_BILLING_LIMITS,
  resultDeadlineMs,
  type AcceptRunResult,
  type RunPhase,
  type StartRunInput,
} from './ai-billing.constants'
import { AiBillingRepository, type DbTransaction } from './ai-billing.repository'
import { CreditsService } from '../credits/credits.service'
import { AiConfigRepository } from '../ai/ai-config.repository'
import { AiService } from '../ai/ai.service'
import { AiUnavailableError } from '../ai/ai-provider'
import { PinoLogger } from 'nestjs-pino'

function utcDayStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  // 只保留短语级原因,避免把供应商 URL/密钥片段写入运行记录。
  return raw.replace(/(api[-_]?key|authorization|bearer)[^,;\s]*/gi, '[redacted]').slice(0, 200)
}

/**
 * Agent 计费协调器:
 * - 受理:短事务内完成 开关→价格→幂等→并发上限→成本预算→冻结→run 创建→outbox;
 * - 执行:Worker 在事务外调用供应商;结果与结算原子提交;
 * - 恢复:对账截止后释放冻结;迟到结果不二次扣费。
 * 数据库是幂等权威,BullMQ 只负责调度(at-least-once)。
 */
@Injectable()
export class AiBillingService {
  constructor(
    @Inject(AiBillingRepository) private readonly repository: AiBillingRepository,
    @Inject(CreditsService) private readonly credits: CreditsService,
    @Inject(AiConfigRepository) private readonly aiConfigRepository: AiConfigRepository,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiBillingService.name)
  }

  quote(action: 'paper_explain') {
    return this.aiConfigRepository.findActivePrice(action)
  }

  async getBalance(userId: string) {
    const balance = await this.credits.getBalance(userId)
    return { available: balance.available, reserved: balance.reserved }
  }

  async startRun(
    userId: string,
    input: StartRunInput,
    idempotencyKey: string,
  ): Promise<AcceptRunResult> {
    const requestHash = this.repository.hashRequest(
      userId,
      idempotencyKey,
      input.action,
      input.input,
    )
    const deadlineAt = new Date(Date.now() + resultDeadlineMs())
    if (!(await this.ai.isRuntimeAvailable())) {
      return { ok: false as const, code: AI_BILLING_ERROR.providerUnavailable.code }
    }
    const result = await this.repository.transaction(async (tx) => {
      // 锁定开关行:关闭提交后不再新受理。
      const configRow = await this.repository.lockServiceConfigInTx(tx)
      if (!configRow || !configRow.aiEnabled || !configRow.featureFlags.paper_explain) {
        return { ok: false as const, code: AI_BILLING_ERROR.billingDisabled.code }
      }
      const price = await this.repository.findActivePrice(input.action)
      if (!price) {
        return { ok: false as const, code: AI_BILLING_ERROR.priceMissing.code }
      }
      if (
        price.version !== input.expectedPrice.priceVersion ||
        price.priceCredits !== input.expectedPrice.priceCredits
      ) {
        return { ok: false as const, code: AI_BILLING_ERROR.priceChanged.code }
      }
      const existing = await this.repository.findRunByIdempotencyKeyInTx(tx, userId, idempotencyKey)
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return { ok: false as const, code: AI_BILLING_ERROR.idempotencyReused.code }
        }
        const reservation = await this.repository.findReservationByRunId(existing.id)
        return {
          ok: true as const,
          runId: existing.id,
          replayed: true,
          priceCredits: existing.reservedCredits ?? price.priceCredits,
          priceVersion: existing.priceVersion ?? price.version,
          reservedCredits: reservation?.amount ?? existing.reservedCredits ?? price.priceCredits,
          deadlineAt: reservation?.deadlineAt ?? deadlineAt,
        }
      }
      const activeRuns = await this.repository.countActiveRunsInTx(tx, userId)
      if (activeRuns >= AI_BILLING_LIMITS.maxActiveRunsPerUser) {
        return { ok: false as const, code: AI_BILLING_ERROR.runLimit.code }
      }
      // 平台成本保护:按价格快照的保守估算预留当日预算。
      const estimate = price.configSnapshot.estimatedCostPerRun
      const now = new Date()
      const dayStart = utcDayStart(now)
      const budgetRow = await this.repository.upsertAndLockBudgetInTx(
        tx,
        dayStart,
        new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
        configRow.dailyCostBudget,
      )
      if (
        configRow.costProtectionEnabled &&
        configRow.dailyCostBudget !== null &&
        Number(budgetRow.reservedCost) + Number(budgetRow.confirmedCost) + Number(estimate) >
          Number(configRow.dailyCostBudget)
      ) {
        return { ok: false as const, code: AI_BILLING_ERROR.costBudgetExceeded.code }
      }
      if (!(await this.ai.isRuntimeAvailable())) {
        return { ok: false as const, code: AI_BILLING_ERROR.providerUnavailable.code }
      }
      await this.repository.adjustBudgetCostInTx(tx, dayStart, { reserved: estimate })
      const run = await this.repository.insertRunInTx(tx, {
        userId,
        idempotencyKey,
        requestHash,
        priceVersion: price.version,
        reservedCredits: price.priceCredits,
        inputPayload: input.input,
      })
      const reservation = await this.credits.reserveInTx(tx, {
        userId,
        runId: run.id,
        amount: price.priceCredits,
        priceVersion: price.version,
        deadlineAt,
      })
      if (!reservation.ok) {
        return { ok: false as const, code: reservation.code }
      }
      return {
        ok: true as const,
        runId: run.id,
        replayed: false,
        priceCredits: price.priceCredits,
        priceVersion: price.version,
        reservedCredits: price.priceCredits,
        deadlineAt,
      }
    })
    if (!result.ok) {
      return result
    }
    // 受理即落库;执行由计费循环在下一轮扫描发现(受理后约 1.5 秒内)。
    return result
  }

  async getRun(userId: string, runId: string) {
    const row = await this.repository.findRunWithReservation(runId)
    if (!row || row.run.userId !== userId) {
      return null
    }
    const { run, reservation } = row
    const now = Date.now()
    let phase: RunPhase
    if (run.status === 'completed') {
      phase = 'completed'
    } else if (run.status === 'failed') {
      phase = run.error === 'result_deadline_exceeded' ? 'expired' : 'failed'
    } else if (reservation && reservation.status === 'active') {
      phase = reservation.deadlineAt.getTime() > now ? 'running' : 'reconciling'
    } else {
      phase = 'reconciling'
    }
    // 契约语义映射:active(冻结中) 对客户端展示为 reserved。
    const settlement = reservation
      ? {
          state: reservation.status === 'active' ? ('reserved' as const) : reservation.status,
          credits: reservation.amount,
        }
      : null
    const balance = await this.credits.getBalance(userId)
    return {
      runId: run.id,
      status: run.status,
      runPhase: phase,
      output: (run.output as PaperExplainOutput | null) ?? null,
      error: run.error,
      settlement,
      balance: { available: balance.available, reserved: balance.reserved },
    }
  }

  /** 事务外执行供应商调用;成功/失败/未知分别结算、释放、进入对账。 */
  async executeRun(runId: string): Promise<'completed' | 'failed' | 'reconcile'> {
    const row = await this.repository.findRunWithReservation(runId)
    if (!row || row.run.status !== 'pending') {
      // 已终态:重复消费/迟到执行,直接忽略。
      return 'completed'
    }
    const { run } = row
    const input = run.input as unknown as Parameters<AiService['completeExplain']>[0]
    const billedModel = await this.modelOfPriceVersion(run.priceVersion)
    try {
      const { text, model } = await this.ai.completeExplain(input, undefined, {
        modelOverride: billedModel,
      })
      const output = this.ai.parseExplainOutput(text, run.id, model)
      await this.repository.transaction(async (tx) => {
        // CAS 终态化与结算同事务:迟到结果(已对账释放)不会二次结算扣费。
        const casOk = await this.repository.casCompleteRunInTx(tx, run.id, { output, model })
        if (!casOk) {
          return
        }
        const reservation = await this.repository.findReservationByRunId(run.id)
        if (reservation && reservation.status === 'active') {
          await this.credits.settleInTx(tx, reservation.id)
          const estimate = await this.estimateOfPriceVersion(run.priceVersion)
          await this.adjustBudgetInTx(tx, run.createdAt, {
            confirmed: estimate,
            reserved: this.negative(estimate),
          })
        }
      })
      this.logger.info({ runId: run.id }, 'Agent 运行完成并结算')
      return 'completed'
    } catch (error) {
      if (error instanceof AiUnavailableError) {
        // 请求被供应商拒绝(限流/不可用),执行未发生,可安全重试。
        this.logger.warn({ runId: run.id }, '供应商暂不可用,等待重试')
        throw error
      }
      if (isTimeout(error)) {
        // 执行情况不明:不盲目重试外部调用;计费循环在对账截止后释放冻结。
        return 'reconcile'
      }
      await this.failRun(runId, sanitizeError(error))
      return 'failed'
    }
  }

  /** 对账:超过截止时间仍无结果则终态化并释放冻结;晚到结果无法再扣费。 */
  async reconcileRun(runId: string): Promise<void> {
    const released = await this.repository.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, 'pending')))
        .for('update')
      if (!run) {
        return false
      }
      const reservation = await this.repository.findReservationByRunId(runId)
      if (!reservation || reservation.status !== 'active') {
        return false
      }
      const casOk = await this.repository.casFailRunInTx(tx, runId, 'result_deadline_exceeded')
      if (!casOk) {
        return false
      }
      await this.credits.releaseInTx(tx, reservation.id)
      const estimate = await this.estimateOfPriceVersion(run.priceVersion)
      await this.adjustBudgetInTx(tx, run.createdAt, {
        reserved: this.negative(estimate),
      })
      return true
    })
    if (released) {
      this.logger.warn({ runId }, '运行超过对账截止,已释放冻结')
    }
  }

  async failRun(runId: string, message: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, 'pending')))
        .for('update')
      if (!run) {
        return
      }
      const casOk = await this.repository.casFailRunInTx(tx, runId, message)
      if (!casOk) {
        return
      }
      const reservation = await this.repository.findReservationByRunId(runId)
      if (reservation && reservation.status === 'active') {
        await this.credits.releaseInTx(tx, reservation.id)
        const estimate = await this.estimateOfPriceVersion(run.priceVersion)
        await this.adjustBudgetInTx(tx, run.createdAt, {
          reserved: this.negative(estimate),
        })
      }
    })
  }

  /** 价格版本不可变,据此取回与预留一致的估算口径。 */
  private async estimateOfPriceVersion(priceVersion: number | null): Promise<string> {
    const match = await this.priceByVersion(priceVersion)
    return match?.configSnapshot.estimatedCostPerRun ?? '0'
  }

  private async modelOfPriceVersion(priceVersion: number | null): Promise<string | undefined> {
    const match = await this.priceByVersion(priceVersion)
    return match?.configSnapshot.model
  }

  private async priceByVersion(priceVersion: number | null) {
    if (priceVersion === null) {
return null
}
    const prices = await this.aiConfigRepository.listPrices()
    return prices.find((price) => price.version === priceVersion) ?? null
  }

  private negative(amount: string): string {
    return (-Number(amount)).toFixed(4)
  }

  private async adjustBudgetInTx(
    tx: DbTransaction,
    acceptedAt: Date,
    delta: { reserved?: string; confirmed?: string },
  ) {
    await tx
      .update(aiCostBudgets)
      .set({
        reservedCost: sql`${aiCostBudgets.reservedCost} + ${delta.reserved ?? '0'}::numeric`,
        confirmedCost: sql`${aiCostBudgets.confirmedCost} + ${delta.confirmed ?? '0'}::numeric`,
        updatedAt: new Date(),
      })
      .where(eq(aiCostBudgets.periodStart, utcDayStart(acceptedAt)))
  }

  /** 待执行运行:受理后超过 executeAfter 仍 pending(排除在途)。 */
  listPendingRuns(executeAfter: Date, limit: number) {
    return this.repository.listStuckPendingRuns(executeAfter, limit)
  }

  /** 到期对账:deadline 已过仍 active 的冻结全部释放并终态化。 */
  async reconcileExpired(): Promise<void> {
    const expired = await this.repository.findExpiredActiveReservations(new Date(), 20)
    for (const reservation of expired) {
      await this.reconcileRun(reservation.runId)
    }
  }
}
