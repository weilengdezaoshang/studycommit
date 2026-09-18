import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import {
  agentRuns,
  aiCostBudgets,
  aiPriceVersions,
  aiServiceConfig,
  creditReservations,
} from '../database/schema'

export type DbTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]
export type AgentRunRow = typeof agentRuns.$inferSelect
export type ReservationRow = typeof creditReservations.$inferSelect
export type PriceRow = typeof aiPriceVersions.$inferSelect

/** 受理事务与 Worker 恢复所需的运行/预算 SQL。 */
@Injectable()
export class AiBillingRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  transaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.database.db.transaction(work)
  }

  /** 诊断用:连接池状态。 */
  poolTotal() {
    return this.database.pool.totalCount
  }
  poolIdle() {
    return this.database.pool.idleCount
  }
  poolWaiting() {
    return this.database.pool.waitingCount
  }

  hashRequest(userId: string, idempotencyKey: string, action: string, input: unknown): string {
    return createHash('sha256')
      .update(userId)
      .update('|')
      .update(idempotencyKey)
      .update('|')
      .update(action)
      .update('|')
      .update(JSON.stringify(input))
      .digest('hex')
  }

  /** 锁定服务开关行;行不存在视为全部关闭(默认安全)。 */
  async lockServiceConfigInTx(tx: DbTransaction) {
    const [row] = await tx
      .select()
      .from(aiServiceConfig)
      .where(eq(aiServiceConfig.id, 1))
      .for('update')
    return row ?? null
  }

  async findActivePrice(action: string): Promise<PriceRow | null> {
    const [row] = await this.database.db
      .select()
      .from(aiPriceVersions)
      .where(and(eq(aiPriceVersions.action, action), eq(aiPriceVersions.isActive, true)))
      .limit(1)
    return row ?? null
  }

  async findRunByIdempotencyKeyInTx(tx: DbTransaction, userId: string, idempotencyKey: string) {
    const [row] = await tx
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.userId, userId), eq(agentRuns.idempotencyKey, idempotencyKey)))
      .limit(1)
    return row ?? null
  }

  async findRunById(runId: string) {
    const [row] = await this.database.db.select().from(agentRuns).where(eq(agentRuns.id, runId))
    return row ?? null
  }

  async findRunWithReservation(runId: string) {
    const [row] = await this.database.db
      .select({ run: agentRuns, reservation: creditReservations })
      .from(agentRuns)
      .leftJoin(creditReservations, eq(creditReservations.runId, agentRuns.id))
      .where(eq(agentRuns.id, runId))
    return row ?? null
  }

  async countActiveRunsInTx(tx: DbTransaction, userId: string) {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(creditReservations)
      .where(and(eq(creditReservations.userId, userId), eq(creditReservations.status, 'active')))
    return row?.count ?? 0
  }

  /** 每日预算行:受理时确保存在,锁定用于保守预留。 */
  async upsertAndLockBudgetInTx(
    tx: DbTransaction,
    dayStart: Date,
    dayEnd: Date,
    budget: string | null,
  ) {
    await tx
      .insert(aiCostBudgets)
      .values({ periodStart: dayStart, periodEnd: dayEnd, budget: budget ?? '0' })
      .onConflictDoNothing({ target: aiCostBudgets.periodStart })
    const [row] = await tx
      .select()
      .from(aiCostBudgets)
      .where(eq(aiCostBudgets.periodStart, dayStart))
      .for('update')
    return row
  }

  async adjustBudgetCostInTx(
    tx: DbTransaction,
    dayStart: Date,
    delta: { reserved?: string; confirmed?: string },
  ) {
    await tx
      .update(aiCostBudgets)
      .set({
        reservedCost: sql`${aiCostBudgets.reservedCost} + ${delta.reserved ?? '0'}::numeric`,
        confirmedCost: sql`${aiCostBudgets.confirmedCost} + ${delta.confirmed ?? '0'}::numeric`,
        updatedAt: new Date(),
      })
      .where(eq(aiCostBudgets.periodStart, dayStart))
  }

  async findBudgetByPeriod(dayStart: Date) {
    const [row] = await this.database.db
      .select()
      .from(aiCostBudgets)
      .where(eq(aiCostBudgets.periodStart, dayStart))
    return row ?? null
  }

  async insertRunInTx(
    tx: DbTransaction,
    input: {
      userId: string
      idempotencyKey: string
      requestHash: string
      priceVersion: number
      reservedCredits: number
      inputPayload: unknown
    },
  ): Promise<AgentRunRow> {
    const [row] = await tx
      .insert(agentRuns)
      .values({
        userId: input.userId,
        kind: 'paper_explain',
        status: 'pending',
        promptVersion: 'paper-explain@1',
        input: input.inputPayload as Record<string, unknown>,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        priceVersion: input.priceVersion,
        reservedCredits: input.reservedCredits,
      })
      .returning()
    return row
  }

  /** CAS 终态化(事务内):只有 pending → 目标态会成功,重复结果/迟到结果天然幂等。 */
  async casCompleteRunInTx(
    tx: DbTransaction,
    runId: string,
    patch: { output: unknown; model: string },
  ): Promise<boolean> {
    const rows = await tx
      .update(agentRuns)
      .set({
        status: 'completed',
        output: patch.output as Record<string, unknown>,
        model: patch.model,
        updatedAt: new Date(),
      })
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, 'pending')))
      .returning({ id: agentRuns.id })
    return rows.length > 0
  }

  async casFailRunInTx(tx: DbTransaction, runId: string, error: string): Promise<boolean> {
    const rows = await tx
      .update(agentRuns)
      .set({ status: 'failed', error: error.slice(0, 500), updatedAt: new Date() })
      .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, 'pending')))
      .returning({ id: agentRuns.id })
    return rows.length > 0
  }

  async findReservationByRunId(runId: string): Promise<ReservationRow | null> {
    const [row] = await this.database.db
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.runId, runId))
    return row ?? null
  }

  /** 到期对账候选:冻结仍 active 且已过截止时间。 */
  async findExpiredActiveReservations(now: Date, limit: number) {
    return this.database.db
      .select()
      .from(creditReservations)
      .where(
        and(
          eq(creditReservations.status, 'active'),
          sql`${creditReservations.deadlineAt} <= ${now.toISOString()}`,
        ),
      )
      .orderBy(creditReservations.deadlineAt)
      .limit(limit)
  }

  /** 启动/周期恢复:受理后长时间无结果的运行。 */
  async listStuckPendingRuns(before: Date, limit: number) {
    return this.database.db
      .select({ run: agentRuns, reservation: creditReservations })
      .from(agentRuns)
      .innerJoin(creditReservations, eq(creditReservations.runId, agentRuns.id))
      .where(
        and(
          eq(agentRuns.status, 'pending'),
          eq(creditReservations.status, 'active'),
          sql`${agentRuns.updatedAt} < ${before.toISOString()}`,
        ),
      )
      .limit(limit)
  }
}
