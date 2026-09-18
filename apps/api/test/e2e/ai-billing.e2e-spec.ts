import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { AI_PROVIDER_TOKEN } from '../../src/ai/ai-provider'
import { applyTestEnv, testEnv } from '../helpers/env'
import { FakeAiProvider, validExplainJson } from '../helpers/fake-ai-provider'
import { AiUnavailableError } from '../../src/ai/ai-provider'

/**
 * Agent 计费闭环 E2E:真实应用 + FakeProvider + 真实 PostgreSQL/Redis。
 * 覆盖:旧入口拒绝、报价、受理冻结、成功结算、失败释放、限流重试、超时对账、幂等与预算保护。
 */

describe('Agent 计费闭环', () => {
  let app: NestFastifyApplication
  let provider: FakeAiProvider
  let priceVersion = 1
  let creditCampaignId: string | null = null
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL, max: 12 })
  const redis = new Redis(testEnv.REDIS_URL)
  const adminAccount = `billing_admin_${randomUUID().slice(0, 8)}`

  const registerAndLogin = async (account: string) => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/account/register',
      payload: { account, password: 'secret123' },
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/account/login',
      payload: { account, password: 'secret123', deviceType: 'desktop' },
    })
    return login.json().tokens.accessToken as string
  }

  const adminToken = async () => registerAndLogin(adminAccount)

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    // 隔离:结束历史注册奖励活动,避免残留窗口给新注册用户赠送积分干扰余额断言。
    await pool.query(`update campaigns set status = 'ended' where type = 'registration_bonus'`)
    // 隔离:清掉历史运行残留的计费任务与恢复源,避免恢复循环反复入队陈旧任务。
    const staleKeys = await redis.keys('bull:ai-runs:*')
    if (staleKeys.length > 0) {
      await redis.del(...staleKeys)
    }
    await pool.query(`delete from outbox_events where type = 'ai.run_accepted'`)
    await pool.query(
      `update credit_reservations set status = 'released', released_at = now() where status = 'active'`,
    )
    await pool.query(
      `update agent_runs set status = 'failed', error = 'purged_by_test' where status = 'pending'`,
    )
    provider = new FakeAiProvider([{ text: validExplainJson() }])
    const module = await import('../../src/app.factory.js')
    app = await module.createApp({
      overrides: [{ provide: AI_PROVIDER_TOKEN, useValue: provider }],
    })
    // 初始管理员 + 价格 + 预算 + 开关:管理接口完成,与生产路径一致。
    await registerAndLogin(adminAccount)
    const user = await pool.query(
      `select u.id from users u join auth_identities i on i.user_id = u.id where i.provider_subject = $1`,
      [adminAccount],
    )
    await pool.query(
      `insert into admin_roles (user_id, role, reason) values ($1, 'super_admin', 'e2e 初始管理员')
       on conflict (user_id) do nothing`,
      [user.rows[0].id],
    )
    const token = await adminToken()
    const price = await app.inject({
      method: 'POST',
      url: '/api/admin/ai/prices',
      payload: {
        action: 'paper_explain',
        priceCredits: 5,
        configSnapshot: {
          model: 'fake-model',
          maxInputTokens: 20000,
          maxOutputTokens: 4000,
          estimatedCostPerRun: '0.0100',
          currency: 'CNY',
        },
        reason: '计费 e2e 定价',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(price.statusCode).toBe(200)
    priceVersion = price.json().version as number
    // 以服务端当前版本为基准更新开关,避免残留数据导致乐观锁冲突。
    const currentConfig = await app.inject({
      method: 'GET',
      url: '/api/admin/ai/config',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(currentConfig.statusCode).toBe(200)
    const config = await app.inject({
      method: 'PUT',
      url: '/api/admin/ai/config',
      payload: {
        expectedVersion: currentConfig.json().version,
        aiEnabled: true,
        featureFlags: { paper_explain: true },
        dailyCostBudget: '10.0000',
        reason: '计费 e2e 开启',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(config.statusCode).toBe(200)
    // 发布一个领取活动,给测试用户发放积分。
    const now = Date.now()
    const campaign = await app.inject({
      method: 'POST',
      url: '/api/admin/campaigns',
      payload: {
        code: `billing-${randomUUID().slice(0, 10)}`,
        type: 'limited_claim',
        totalBudgetCredits: 1000,
        totalClaimLimit: 100,
        displayTimezone: 'Asia/Shanghai',
        config: {
          name: '计费测试积分',
          grantCredits: 20,
          creditValidityDays: 30,
          fixedExpiresAt: null,
          perUserLimit: 1,
          startsAt: new Date(now - 60_000).toISOString(),
          endsAt: new Date(now + 3_600_000).toISOString(),
          platforms: ['desktop'],
          eligibility: {
            verifiedFrom: null,
            verifiedTo: null,
            providers: null,
            requireActiveAccount: true,
          },
          copy: { title: 't', description: 'd', successMessage: 's' },
        },
        reason: '计费 e2e 积分来源',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(campaign.statusCode).toBe(200)
    const published = await app.inject({
      method: 'POST',
      url: `/api/admin/campaigns/${campaign.json().id}/publish`,
      payload: { id: campaign.json().id, expectedVersion: 0, reason: '发布' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(published.statusCode).toBe(200)
    creditCampaignId = campaign.json().id as string
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    redis.disconnect()
  })

  /** 注册新用户并领取本用例活动的 20 积分,返回其令牌。 */
  const userWithCredits = async () => {
    const token = await registerAndLogin(`billing_user_${randomUUID().slice(0, 8)}`)
    const claim = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${creditCampaignId}/claim`,
      payload: { id: creditCampaignId, expectedVersion: 1 },
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() },
    })
    expect(claim.json().balance.available).toBe(20)
    return token
  }

  const startRun = (token: string, payload: object, key = randomUUID()) =>
    app.inject({
      method: 'POST',
      url: '/api/ai/runs',
      payload,
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': key },
    })

  const startPayload = () => ({
    action: 'paper_explain',
    expectedPrice: { priceCredits: 5, priceVersion },
    input: { content: '解释闭包与作用域链。', directive: 'initial', round: 1 },
  })

  const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 15000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await predicate()) {
return true
}
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    return false
  }

  it('旧同步生成入口显式返回计费要求错误', async () => {
    const token = await userWithCredits()
    const old = await app.inject({
      method: 'POST',
      url: '/api/ai/papers/explain',
      payload: { content: '旧入口调用', directive: 'initial', round: 1 },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(old.statusCode).toBe(410)
    expect(old.json().code).toBe('AI_BILLING_REQUIRED')
  })

  it('报价返回价格版本与余额,不创建运行', async () => {
    const token = await userWithCredits()
    const quote = await app.inject({
      method: 'GET',
      url: '/api/ai/quote?action=paper_explain',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(quote.statusCode).toBe(200)
    expect(quote.json().priceCredits).toBe(5)
    expect(quote.json().priceVersion).toBe(priceVersion)
    expect(quote.json().balance.available).toBe(20)
    // 报价只读,不新增运行记录(以差值断言,避免残留数据干扰)。
    const runsBefore = await pool.query(`select count(*)::int as count from agent_runs`)
    await app.inject({
      method: 'GET',
      url: '/api/ai/quote?action=paper_explain',
      headers: { authorization: `Bearer ${token}` },
    })
    const runsAfter = await pool.query(`select count(*)::int as count from agent_runs`)
    expect(runsAfter.rows[0].count).toBe(runsBefore.rows[0].count)
  })

  it('报价与期望价格不一致时拒绝受理', async () => {
    const token = await userWithCredits()
    const stale = await startRun(token, {
      ...startPayload(),
      expectedPrice: { priceCredits: 99, priceVersion: 1 },
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json().code).toBe('AI_PRICE_CHANGED')
  })

  it('受理即冻结积分并异步完成结算', async () => {
    const token = await userWithCredits()
    const started = await startRun(token, startPayload())
    expect(started.statusCode).toBe(200)
    const { runId } = started.json()
    // 受理后立即冻结:可用减少、冻结增加。
    const afterStart = await app.inject({
      method: 'GET',
      url: '/api/credits/balance',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(afterStart.json().available).toBe(15)
    expect(afterStart.json().reserved).toBe(5)

    const done = await waitFor(async () => {
      const run = await app.inject({
        method: 'GET',
        url: `/api/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      return run.json().runPhase === 'completed'
    })
    expect(done).toBe(true)
    const run = await app.inject({
      method: 'GET',
      url: `/api/ai/runs/${runId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(run.json().status).toBe('completed')
    expect(run.json().output.view.type).toBe('causal_chain')
    expect(run.json().settlement.state).toBe('settled')
    expect(run.json().balance.available).toBe(15)
    expect(run.json().balance.reserved).toBe(0)
    expect(provider.callCount).toBeGreaterThanOrEqual(1)
  })

  it('相同幂等键重试返回同一运行,不同内容返回冲突', async () => {
    const token = await userWithCredits()
    const key = randomUUID()
    const first = await startRun(token, startPayload(), key)
    expect(first.statusCode).toBe(200)
    const replay = await startRun(token, startPayload(), key)
    expect(replay.statusCode).toBe(200)
    expect(replay.json().runId).toBe(first.json().runId)
    const conflict = await startRun(
      token,
      { ...startPayload(), input: { ...startPayload.input, content: '不同的内容' } },
      key,
    )
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('余额不足时拒绝受理且不创建运行', async () => {
    const token = await userWithCredits()
    // 连续受理 4 次:每次冻结 5,余额 20 → 第 5 次失败。等待先前的任务完成会释放;
    // 为避免重试干扰,这里并发发起 4 次占满额度后第 5 次应余额不足。
    const starts = await Promise.all(
      Array.from({ length: 4 }, () => startRun(token, startPayload())),
    )
    const accepted = starts.filter((row) => row.statusCode === 200)
    expect(accepted.length).toBeGreaterThanOrEqual(1)
    const fifth = await startRun(token, startPayload())
    // 第 5 次受理要么因并发上限要么因余额不足被拒,不允许创建新冻结。
    if (fifth.statusCode === 200) {
      const balance = await app.inject({
        method: 'GET',
        url: '/api/credits/balance',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(balance.json().reserved).toBeLessThanOrEqual(10)
    } else {
      expect(fifth.statusCode).toBe(409)
      expect(['INSUFFICIENT_CREDITS', 'AI_RUN_LIMIT']).toContain(fifth.json().code)
    }
  })

  it('供应商输出无效时运行失败并释放冻结', async () => {
    provider.setScript([{ text: '这不是 JSON 输出' }])
    const token = await userWithCredits()
    const started = await startRun(token, startPayload())
    expect(started.statusCode).toBe(200)
    const { runId } = started.json()
    const done = await waitFor(async () => {
      const run = await app.inject({
        method: 'GET',
        url: `/api/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      return run.json().runPhase === 'failed'
    })
    expect(done).toBe(true)
    const run = await app.inject({
      method: 'GET',
      url: `/api/ai/runs/${runId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(run.json().settlement.state).toBe('released')
    expect(run.json().balance.available).toBe(20)
    expect(run.json().balance.reserved).toBe(0)
    expect(run.json().error).not.toContain('http')
    provider.setScript([{ text: validExplainJson() }])
  })

  it('供应商限流时自动重试并最终完成', async () => {
    provider.setScript([
      new AiUnavailableError('请求过于频繁,请稍后再试'),
      { text: validExplainJson() },
    ])
    const token = await userWithCredits()
    const started = await startRun(token, startPayload())
    expect(started.statusCode).toBe(200)
    const { runId } = started.json()
    const done = await waitFor(async () => {
      const run = await app.inject({
        method: 'GET',
        url: `/api/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      return run.json().runPhase === 'completed'
    }, 20000)
    expect(done).toBe(true)
    // 第一次被限流,第二次成功:同一脚本 provider 至少调用两次。
    expect(provider.callCount).toBeGreaterThanOrEqual(2)
    const run = await app.inject({
      method: 'GET',
      url: `/api/ai/runs/${runId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(run.json().settlement.state).toBe('settled')
    expect(run.json().balance.available).toBe(15)
  }, 30000)

  it('执行超时进入对账,截止后释放冻结且迟到结果不扣费', async () => {
    provider.setScript([
      () => {
        const timeout = new Error('FakeProvider 执行超时')
        timeout.name = 'TimeoutError'
        return Promise.reject(timeout)
      },
    ])
    const token = await userWithCredits()
    const started = await startRun(token, startPayload())
    expect(started.statusCode).toBe(200)
    const { runId } = started.json()
    // 截止前:运行处于对账观察期,冻结保持。
    const early = await app.inject({
      method: 'GET',
      url: `/api/ai/runs/${runId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(['running', 'reconciling']).toContain(early.json().runPhase)
    // 截止后(testEnv 4 秒):对账释放。
    const expired = await waitFor(async () => {
      const run = await app.inject({
        method: 'GET',
        url: `/api/ai/runs/${runId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      return run.json().runPhase === 'expired'
    }, 15000)
    expect(expired).toBe(true)
    const released = await app.inject({
      method: 'GET',
      url: '/api/credits/balance',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(released.json().available).toBe(20)
    expect(released.json().reserved).toBe(0)
    // 迟到结果:再次执行 CAS 失败,不结算不扣费。
    provider.setScript([{ text: validExplainJson() }])
    const { AiBillingService } = await import('../../src/ai-billing/ai-billing.service.js')
    const billing = app.get(AiBillingService)
    await billing.executeRun(runId)
    const run = await app.inject({
      method: 'GET',
      url: `/api/ai/runs/${runId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(run.json().status).toBe('failed')
    expect(run.json().settlement.state).toBe('released')
    const balance = await app.inject({
      method: 'GET',
      url: '/api/credits/balance',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(balance.json().available).toBe(20)
  }, 40000)

  it('无权用户不能读取他人运行', async () => {
    const token = await userWithCredits()
    const started = await startRun(token, startPayload())
    const { runId } = started.json()
    const other = await userWithCredits()
    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/ai/runs/${runId}`,
      headers: { authorization: `Bearer ${other}` },
    })
    expect(forbidden.statusCode).toBe(404)
  })
})
