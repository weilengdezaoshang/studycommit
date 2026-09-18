import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { applyTestEnv, testEnv } from '../helpers/env'
import type { DatabaseService } from '../../src/database/database.service'
import type { PinoLogger } from 'nestjs-pino'
import { CreditsService } from '../../src/credits/credits.service'
import { CreditsRepository } from '../../src/credits/credits.repository'

/**
 * 积分账务集成测试:真实 PostgreSQL 上验证冻结/结算/释放/到期与并发不变量。
 * 不经过 Nest 依赖注入,直接构造仓库与服务以聚焦账务事务本身。
 */

const silentLogger = {
  setContext: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as PinoLogger

async function insertUser(pool: Pool): Promise<string> {
  const userId = randomUUID()
  await pool.query(`insert into users (id) values ($1)`, [userId])
  return userId
}

async function insertRun(pool: Pool, userId: string): Promise<string> {
  const runId = randomUUID()
  await pool.query(
    `insert into agent_runs (id, user_id, kind, status, prompt_version, input)
     values ($1, $2, 'paper_explain', 'pending', 'test-v1', '{}'::jsonb)`,
    [runId, userId],
  )
  return runId
}

describe('积分账务(真实 PostgreSQL)', () => {
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL, max: 16 })
  let credits: CreditsService
  let repo: CreditsRepository

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const database = { db: drizzle(pool) } as unknown as DatabaseService
    repo = new CreditsRepository(database)
    credits = new CreditsService(repo, silentLogger)
  })

  afterAll(async () => {
    await pool.end()
  })

  const grant = async (userId: string, amount: number, expiresAt: Date | null) => {
    const result = await repo.transaction(async (tx) =>
      credits.grantInTx(tx, { userId, amount, source: 'campaign', expiresAt }),
    )
    expect(result.ok).toBe(true)
  }

  it('余额只够一次时,两次并发生成只有一次冻结成功且余额不为负', async () => {
    const userId = await insertUser(pool)
    await grant(userId, 10, null)
    const runA = await insertRun(pool, userId)
    const runB = await insertRun(pool, userId)

    const results = await Promise.all([
      credits.reserve({
        userId,
        runId: runA,
        amount: 10,
        priceVersion: 1,
        deadlineAt: new Date(Date.now() + 60_000),
      }),
      credits.reserve({
        userId,
        runId: runB,
        amount: 10,
        priceVersion: 1,
        deadlineAt: new Date(Date.now() + 60_000),
      }),
    ])
    const succeeded = results.filter((row) => row.ok)
    const failed = results.filter((row) => !row.ok)
    expect(succeeded).toHaveLength(1)
    expect(failed).toHaveLength(1)
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(0)
    expect(balance.reserved).toBe(10)
  })

  it('重复结算幂等:第二次结算不改变余额', async () => {
    const userId = await insertUser(pool)
    await grant(userId, 6, null)
    const runId = await insertRun(pool, userId)
    const reserved = await credits.reserve({
      userId,
      runId,
      amount: 6,
      priceVersion: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    })
    expect(reserved.ok).toBe(true)
    const reservationId = reserved.ok ? reserved.reservationId : ''

    const first = await credits.settle(reservationId)
    expect(first.ok).toBe(true)
    const second = await credits.settle(reservationId)
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.code).toBe('CREDITS_RESERVATION_ALREADY_CLOSED')
    }
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(0)
    expect(balance.reserved).toBe(0)
  })

  it('冻结期间批次到期后释放:只恢复未过期部分,过期部分不回到可用额', async () => {
    const userId = await insertUser(pool)
    // 两笔批次在冻结时均有效;冻结后把其中一笔改为已到期,模拟"冻结跨到期"。
    await grant(userId, 5, new Date(Date.now() + 60 * 60_000))
    await grant(userId, 5, new Date(Date.now() + 2 * 60 * 60_000))
    const runId = await insertRun(pool, userId)
    const reserved = await credits.reserve({
      userId,
      runId,
      amount: 10,
      priceVersion: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) {
return
}
    await pool.query(
      `update credit_grants set expires_at = now() - interval '1 minute'
       where id = (select grant_id from credit_allocations where reservation_id = $1 order by amount desc limit 1)`,
      [reserved.reservationId],
    )
    const released = await credits.release(reserved.reservationId)
    expect(released.ok).toBe(true)
    if (!released.ok) {
return
}
    expect(released.expiredCredits).toBe(5)
    expect(released.restoredCredits).toBe(5)
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(5)
    expect(balance.reserved).toBe(0)
  })

  it('先到期先使用:冻结按批次到期顺序分配', async () => {
    const userId = await insertUser(pool)
    await grant(userId, 5, new Date(Date.now() + 10 * 60_000))
    await grant(userId, 5, new Date(Date.now() + 60 * 60_000))
    await grant(userId, 5, null)
    const runId = await insertRun(pool, userId)
    const reserved = await credits.reserve({
      userId,
      runId,
      amount: 8,
      priceVersion: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) {
return
}
    expect(reserved.allocated).toHaveLength(2)
    const first = await pool.query(
      `select g.remaining_available, g.frozen_amount, g.expires_at
       from credit_allocations a join credit_grants g on g.id = a.grant_id
       where a.reservation_id = $1
       order by g.expires_at asc nulls last`,
      [reserved.reservationId],
    )
    expect(first.rows[0].frozen_amount).toBe(5)
    expect(first.rows[1].frozen_amount).toBe(3)
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(7)
    expect(balance.reserved).toBe(8)
  })

  it('查询余额前惰性处理过期未冻结额', async () => {
    const userId = await insertUser(pool)
    await grant(userId, 5, new Date(Date.now() - 60_000))
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(0)
    const grantRows = await pool.query(
      `select status, remaining_available from credit_grants where user_id = $1`,
      [userId],
    )
    expect(grantRows.rows[0].status).toBe('expired')
    expect(grantRows.rows[0].remaining_available).toBe(0)
  })

  it('失败释放幂等:第二次释放不改变余额', async () => {
    const userId = await insertUser(pool)
    await grant(userId, 4, null)
    const runId = await insertRun(pool, userId)
    const reserved = await credits.reserve({
      userId,
      runId,
      amount: 4,
      priceVersion: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    })
    if (!reserved.ok) {
throw new Error('冻结应成功')
}
    const first = await credits.release(reserved.reservationId)
    expect(first.ok).toBe(true)
    const second = await credits.release(reserved.reservationId)
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.code).toBe('CREDITS_RESERVATION_ALREADY_CLOSED')
    }
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(4)
    expect(balance.reserved).toBe(0)
  })

  it('账务保持可重建:流水重放与账户聚合一致', async () => {
    const userId = await insertUser(pool)
    await grant(userId, 9, null)
    const runId = await insertRun(pool, userId)
    const reserved = await credits.reserve({
      userId,
      runId,
      amount: 4,
      priceVersion: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    })
    if (!reserved.ok) {
throw new Error('冻结应成功')
}
    await credits.settle(reserved.reservationId)

    const replay = await repo.replayLedgerTotals(userId)
    const diff = await repo.accountVsGrantsDiff(userId)
    expect(diff).not.toBeNull()
    expect(diff?.availableMismatch).toBe(false)
    expect(diff?.reservedMismatch).toBe(false)
    const account = await pool.query(
      `select available, reserved from credit_accounts where user_id = $1`,
      [userId],
    )
    expect(account.rows[0].available).toBe(replay.delta_available)
    expect(account.rows[0].reserved).toBe(replay.delta_reserved)
  })

  it('不存在的运行无法创建冻结并返回明确错误码', async () => {
    const userId = await insertUser(pool)
    await grant(userId, 5, null)
    const missingRunId = randomUUID()
    const result = await credits.reserve({
      userId,
      runId: missingRunId,
      amount: 5,
      priceVersion: 1,
      deadlineAt: new Date(Date.now() + 60_000),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CREDITS_RUN_NOT_FOUND')
    }
  })

  it('超上限金额被拒绝', async () => {
    const userId = await insertUser(pool)
    const result = await repo.transaction(async (tx) =>
      credits.grantInTx(tx, { userId, amount: 2_000_000_000, source: 'campaign' }),
    )
    expect(result.ok).toBe(false)
  })
})
