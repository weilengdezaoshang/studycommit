import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { outboxEvents } from '../database/schema'

export type OutboxEventRow = typeof outboxEvents.$inferSelect

/** 事件写入必须发生在业务事务内;此处只提供事务句柄版本与投递器需要的查询。 */
@Injectable()
export class OutboxRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 事务入口:与业务写入共用同一事务。 */
  transaction<T>(
    work: (tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return this.database.db.transaction(work)
  }

  /** 在调用方事务内追加事件;eventId 由调用方生成以便幂等。 */
  async insertInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    input: { eventId: string; type: string; payload: Record<string, unknown> },
  ) {
    await tx.insert(outboxEvents).values({
      eventId: input.eventId,
      type: input.type,
      payload: input.payload,
    })
  }

  /** 认领待投递事件:SKIP LOCKED 允许多实例并行投递而不重复。 */
  async claimDue(limit: number, now: Date): Promise<OutboxEventRow[]> {
    return this.database.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: outboxEvents.eventId })
        .from(outboxEvents)
        .where(
          and(
            or(eq(outboxEvents.status, 'pending'), eq(outboxEvents.status, 'failed')),
            lte(outboxEvents.availableAt, now),
          ),
        )
        .orderBy(asc(outboxEvents.availableAt), asc(outboxEvents.createdAt))
        .limit(limit)
        .for('update', { skipLocked: true })
      if (rows.length === 0) {
        return []
      }
      const ids = rows.map((row) => row.id)
      const claimed = await tx
        .update(outboxEvents)
        .set({ status: 'processing', attempts: sql`${outboxEvents.attempts} + 1` })
        .where(inArray(outboxEvents.eventId, ids))
        .returning()
      return claimed
    })
  }

  async markDone(eventId: string) {
    await this.database.db
      .update(outboxEvents)
      .set({ status: 'done', processedAt: new Date(), lastError: null })
      .where(eq(outboxEvents.eventId, eventId))
  }

  /** 失败按尝试次数指数退避;超过上限转 failed 终态,等待补偿任务。 */
  async markFailed(
    eventId: string,
    attempts: number,
    error: string,
    backoffBaseMs: number,
    maxAttempts: number,
  ) {
    const terminal = attempts >= maxAttempts
    const delayMs = backoffBaseMs * 2 ** Math.min(attempts - 1, 8)
    await this.database.db
      .update(outboxEvents)
      .set({
        status: terminal ? 'failed' : 'pending',
        lastError: error.slice(0, 2000),
        availableAt: new Date(Date.now() + delayMs),
      })
      .where(eq(outboxEvents.eventId, eventId))
  }
}
