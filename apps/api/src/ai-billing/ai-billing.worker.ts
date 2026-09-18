import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { AI_BILLING_LIMITS } from './ai-billing.constants'
import { AiBillingService } from './ai-billing.service'

/**
 * 计费执行循环:以 Postgres 为唯一权威的朴素执行器。
 * - 每 tick 扫描待执行运行(受理 1.5 秒后仍 pending)并执行;
 * - 供应商拒绝(限流)的运行留给下一轮重试,直到对账截止;
 * - 到达截止时间的运行由同循环对账释放。
 * 重试与恢复不依赖 Redis 任务队列:进程重启后循环自动从数据库恢复全部待办。
 */
@Injectable()
export class AiBillingWorker implements OnModuleInit, OnModuleDestroy {
  private static readonly TICK_MS = 1_500
  private static readonly EXECUTE_AFTER_MS = 1_500
  private static readonly BATCH = 10

  private timer: NodeJS.Timeout | null = null
  private inFlight = new Set<string>()
  private ticking = false

  constructor(
    @Inject(AiBillingService) private readonly billing: AiBillingService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiBillingWorker.name)
  }

  onModuleInit() {
    const interval = Math.min(
      AiBillingWorker.TICK_MS,
      Math.max(
        250,
        Math.floor(Number(this.config.get('AI_RUN_RESULT_DEADLINE_MS') ?? 180_000) / 8),
      ),
    )
    this.timer = setInterval(() => {
      void this.tick()
    }, interval)
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking) {
return
}
    this.ticking = true
    try {
      await this.executeDueRuns()
      await this.reconcileExpiredRuns()
    } catch (error) {
      this.logger.error({ error }, '计费执行循环异常')
    } finally {
      this.ticking = false
    }
  }

  private async executeDueRuns(): Promise<void> {
    const rows = await this.billing.listPendingRuns(
      new Date(Date.now() - AiBillingWorker.EXECUTE_AFTER_MS),
      AiBillingWorker.BATCH,
    )
    const jobs = rows
      .map((row) => row.run.id)
      .filter((runId) => !this.inFlight.has(runId))
      .slice(0, Math.max(1, AI_BILLING_LIMITS.maxActiveRunsPerUser))
    for (const runId of jobs) {
      this.inFlight.add(runId)
      void this.billing
        .executeRun(runId)
        .catch((error: unknown) => {
          // 供应商拒绝(限流/不可用)交给下一轮重试;其余错误由 executeRun 内部终态化。
          this.logger.warn(
            { runId, error: error instanceof Error ? error.message : String(error) },
            '运行执行暂缓,等待重试',
          )
        })
        .finally(() => {
          this.inFlight.delete(runId)
        })
    }
  }

  private async reconcileExpiredRuns(): Promise<void> {
    await this.billing.reconcileExpired()
  }
}
