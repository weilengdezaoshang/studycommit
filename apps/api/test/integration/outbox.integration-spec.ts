import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { applyTestEnv, testEnv } from '../helpers/env'
import type { DatabaseService } from '../../src/database/database.service'
import { OutboxRepository } from '../../src/outbox/outbox.repository'
import { OutboxService } from '../../src/outbox/outbox.service'
import type { PinoLogger } from 'nestjs-pino'

const silentLogger = {
  setContext: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as PinoLogger

describe('事务事件投递(真实 PostgreSQL)', () => {
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL, max: 8 })
  let repository: OutboxRepository
  let service: OutboxService

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    // 隔离:清掉历史运行残留的待投递事件,保证认领结果只来自本用例。
    await pool.query('delete from outbox_events')
    const database = { db: drizzle(pool) } as unknown as DatabaseService
    repository = new OutboxRepository(database)
    service = new OutboxService(repository, silentLogger)
  })

  afterAll(async () => {
    await pool.end()
  })

  const insertEvent = async (type: string, payload: Record<string, unknown> = {}) => {
    const eventId = randomUUID()
    await repository.transaction(async (tx) =>
      repository.insertInTx(tx, { eventId, type, payload }),
    )
    return eventId
  }

  it('事件写入后由注册的 handler 消费并标记完成', async () => {
    const type = `test.ok.${randomUUID()}`
    const eventId = await insertEvent(type, { userId: randomUUID() })
    const handled: string[] = []
    service.registerHandler(type, async (payload) => {
      handled.push(String(payload.userId))
    })
    // 预留 5 秒余量,避免应用时钟略落后数据库时钟导致事件未到期。
    const processed = await service.dispatchDue(new Date(Date.now() + 5_000))
    expect(processed).toBe(1)
    expect(handled).toHaveLength(1)
    const row = await pool.query(
      `select status, processed_at from outbox_events where event_id = $1`,
      [eventId],
    )
    expect(row.rows[0].status).toBe('done')
    expect(row.rows[0].processed_at).not.toBeNull()
  })

  it('handler 抛错进入退避重试,达到上限转终态', async () => {
    const type = `test.always-fail.${randomUUID()}`
    const eventId = await insertEvent(type, {})
    service.registerHandler(type, async () => {
      throw new Error('投递失败(测试)')
    })
    // 第一次:attempts=1,按指数退避推迟 → 立即再投递时不可认领。
    await service.dispatchDue(new Date(Date.now() + 5_000))
    const afterFirst = await pool.query(
      `select status, attempts, available_at > now() as deferred, last_error from outbox_events where event_id = $1`,
      [eventId],
    )
    expect(afterFirst.rows[0].status).toBe('pending')
    expect(Number(afterFirst.rows[0].attempts)).toBe(1)
    expect(afterFirst.rows[0].deferred).toBe(true)
    expect(afterFirst.rows[0].last_error).toContain('投递失败')
    // 到达重试上限:转 failed 终态,等待人工或补偿任务。
    await repository.markFailed(eventId, 2, '投递失败(测试)', 5_000, 2)
    const terminal = await pool.query(`select status from outbox_events where event_id = $1`, [
      eventId,
    ])
    expect(terminal.rows[0].status).toBe('failed')
  })

  it('SKIP LOCKED 认领:并发投递器不会重复处理同一事件', async () => {
    const type = `test.race.${randomUUID()}`
    const eventId = await insertEvent(type, {})
    const handled: number[] = []
    service.registerHandler(type, async () => {
      handled.push(1)
    })
    await Promise.all([
      service.dispatchDue(new Date(Date.now() + 5_000)),
      service.dispatchDue(new Date(Date.now() + 5_000)),
    ])
    expect(handled).toHaveLength(1)
    const row = await pool.query(`select status from outbox_events where event_id = $1`, [eventId])
    expect(row.rows[0].status).toBe('done')
  })
})
