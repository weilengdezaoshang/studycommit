import { Inject, Injectable } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { PinoLogger } from 'nestjs-pino'
import { OUTBOX_DISPATCH, OUTBOX_ERROR } from './outbox.constants'
import { OutboxRepository } from './outbox.repository'

export type OutboxHandler = (payload: Record<string, unknown>) => Promise<void>

/**
 * 事务事件投递器:outbox_events 表是唯一权威;本服务只按间隔认领并执行。
 * 投递是至少一次语义,handler 必须自己幂等(如领取唯一约束)。
 */
@Injectable()
export class OutboxService {
  private readonly handlers = new Map<string, OutboxHandler>()

  constructor(
    @Inject(OutboxRepository) private readonly repository: OutboxRepository,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OutboxService.name)
  }

  /** 领域模块在初始化时注册消费逻辑;同一类型重复注册视为装配错误。 */
  registerHandler(type: string, handler: OutboxHandler) {
    if (this.handlers.has(type)) {
      throw new Error(`outbox handler 重复注册: ${type}`)
    }
    this.handlers.set(type, handler)
  }

  /** 手动触发一轮投递(测试与运维复用);定时器同样调用它。 */
  async dispatchDue(now = new Date()): Promise<number> {
    const events = await this.repository.claimDue(OUTBOX_DISPATCH.batchSize, now)
    let processed = 0
    for (const event of events) {
      const handler = this.handlers.get(event.type)
      if (!handler) {
        await this.repository.markFailed(
          event.eventId,
          event.attempts,
          `${OUTBOX_ERROR.unknownEventType.code}:${event.type}`,
          OUTBOX_DISPATCH.backoffBaseMs,
          1,
        )
        continue
      }
      try {
        await handler(event.payload)
        await this.repository.markDone(event.eventId)
        processed += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(
          { eventId: event.eventId, type: event.type, error: message },
          'outbox 事件投递失败',
        )
        await this.repository.markFailed(
          event.eventId,
          event.attempts,
          message,
          OUTBOX_DISPATCH.backoffBaseMs,
          OUTBOX_DISPATCH.maxAttempts,
        )
      }
    }
    return processed
  }

  @Interval(OUTBOX_DISPATCH.intervalMs)
  async handleInterval(): Promise<void> {
    try {
      await this.dispatchDue()
    } catch (error) {
      this.logger.error({ error }, 'outbox 投递循环异常')
    }
  }
}
