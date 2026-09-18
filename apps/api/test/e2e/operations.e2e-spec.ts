import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'
import type { CampaignDraftConfig } from '@studycommit/rpc-contracts/campaigns'

/**
 * 运营活动与管理权限 E2E:真实应用 + 真实 PostgreSQL/Redis。
 * 覆盖:管理鉴权(拒绝普通用户与开发身份)、活动生命周期、用户可见与领取、余额流水。
 */

function buildConfig(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now()
  return {
    name: 'E2E 限时领取',
    grantCredits: 5,
    creditValidityDays: 30,
    fixedExpiresAt: null,
    perUserLimit: 1,
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + 60 * 60_000).toISOString(),
    platforms: ['desktop', 'mobile'],
    eligibility: {
      verifiedFrom: null,
      verifiedTo: null,
      providers: null,
      requireActiveAccount: true,
    },
    copy: {
      title: 'E2E 福利',
      description: '测试领取流程',
      successMessage: '领取成功',
    },
    ...overrides,
  } satisfies CampaignDraftConfig
}

describe('运营活动与管理权限 API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL, max: 12 })
  const redis = new Redis(testEnv.REDIS_URL)
  const adminAccount = `e2e_admin_${randomUUID().slice(0, 8)}`

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

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    // 隔离:结束历史注册奖励活动,避免残留窗口给新注册用户赠送积分干扰余额断言。
    await pool.query(`update campaigns set status = 'ended' where type = 'registration_bonus'`)
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
    // 初始管理员:直接落库授权(生产走 scripts/grant-admin.ts,见交付说明)。
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/account/register',
      payload: { account: adminAccount, password: 'secret123' },
    })
    void login
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
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    redis.disconnect()
  })

  const adminToken = async () => registerAndLogin(adminAccount)
  const userToken = async () => registerAndLogin(`e2e_user_${randomUUID().slice(0, 8)}`)

  const createPublishedCampaign = async (
    token: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/campaigns',
      payload: {
        code: `e2e-${randomUUID().slice(0, 10)}`,
        type: 'limited_claim',
        totalBudgetCredits: 1_000,
        totalClaimLimit: 100,
        displayTimezone: 'Asia/Shanghai',
        config: buildConfig(overrides),
        reason: 'e2e 创建活动',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(created.statusCode).toBe(200)
    const campaign = created.json()
    const published = await app.inject({
      method: 'POST',
      url: `/api/admin/campaigns/${campaign.id}/publish`,
      payload: { id: campaign.id, expectedVersion: 0, reason: 'e2e 发布活动' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(published.statusCode).toBe(200)
    return campaign as { id: string }
  }

  it('未登录访问运营引导被拒绝', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/operations/bootstrap' })
    expect(response.statusCode).toBe(401)
  })

  it('开发 x-user-id 身份不能访问管理接口', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/access/me',
      headers: { 'x-user-id': randomUUID() },
    })
    expect([401, 403]).toContain(response.statusCode)
  })

  it('普通用户登录后仍不能访问管理接口', async () => {
    const token = await userToken()
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/access/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(403)
    expect(response.json().error.code).toBe('ADMIN_FORBIDDEN')
  })

  it('管理员可以创建并发布活动,版本随发布递增', async () => {
    const token = await adminToken()
    const me = await app.inject({
      method: 'GET',
      url: '/api/admin/access/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().role).toBe('super_admin')
    const campaign = await createPublishedCampaign(token)
    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/campaigns/${campaign.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().status).toBe('published')
    expect(detail.json().currentVersion).toBe(1)
    expect(detail.json().versions).toHaveLength(1)
  })

  it('发布价格与开关更新写入审计且拒绝无理由操作', async () => {
    const token = await adminToken()
    const noReason = await app.inject({
      method: 'POST',
      url: '/api/admin/ai/prices',
      payload: {
        action: 'paper_explain',
        priceCredits: 5,
        configSnapshot: {
          model: 'test-model',
          maxInputTokens: 20000,
          maxOutputTokens: 4000,
          estimatedCostPerRun: '0.010000',
          currency: 'CNY',
        },
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(noReason.statusCode).toBe(400)
    const published = await app.inject({
      method: 'POST',
      url: '/api/admin/ai/prices',
      payload: {
        action: 'paper_explain',
        priceCredits: 5,
        configSnapshot: {
          model: 'test-model',
          maxInputTokens: 20000,
          maxOutputTokens: 4000,
          estimatedCostPerRun: '0.010000',
          currency: 'CNY',
        },
        reason: 'e2e 首版定价',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(published.statusCode).toBe(200)
    // 版本号基于库中已有版本递增,测试库可能存在历史版本,只要求有效递增。
    expect(published.json().version).toBeGreaterThanOrEqual(1)
    expect(published.json().isActive).toBe(true)
    const audit = await app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs?targetType=ai_price_version',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(audit.statusCode).toBe(200)
    expect(audit.json().items.length).toBeGreaterThanOrEqual(1)
  })

  it('用户可见活动并领取成功,余额与流水随之更新', async () => {
    const token = await adminToken()
    const campaign = await createPublishedCampaign(token)
    const user = await userToken()
    const list = await app.inject({
      method: 'GET',
      url: '/api/campaigns',
      headers: { authorization: `Bearer ${user}` },
    })
    expect(list.statusCode).toBe(200)
    const visible = list.json().campaigns.find((row: { id: string }) => row.id === campaign.id)
    expect(visible).toBeDefined()
    expect(visible.displayStatus).toBe('active')

    const claim = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/claim`,
      payload: { id: campaign.id, expectedVersion: 1 },
      headers: { authorization: `Bearer ${user}`, 'idempotency-key': randomUUID() },
    })
    expect(claim.statusCode).toBe(200)
    expect(claim.json().claim.grantedCredits).toBe(5)
    expect(claim.json().balance.available).toBe(5)

    const balance = await app.inject({
      method: 'GET',
      url: '/api/credits/balance',
      headers: { authorization: `Bearer ${user}` },
    })
    expect(balance.json().available).toBe(5)
    const ledger = await app.inject({
      method: 'GET',
      url: '/api/credits/ledger',
      headers: { authorization: `Bearer ${user}` },
    })
    expect(ledger.json().items.length).toBeGreaterThanOrEqual(1)
    expect(ledger.json().items[0].kind).toBe('grant')
  })

  it('版本不一致的领取被拒绝,携带冲突错误码', async () => {
    const token = await adminToken()
    const campaign = await createPublishedCampaign(token)
    const user = await userToken()
    const claim = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/claim`,
      payload: { id: campaign.id, expectedVersion: 99 },
      headers: { authorization: `Bearer ${user}`, 'idempotency-key': randomUUID() },
    })
    expect(claim.statusCode).toBe(409)
    expect(claim.json().code).toBe('CAMPAIGN_VERSION_CONFLICT')
  })

  it('活动暂停后领取被拒绝', async () => {
    const token = await adminToken()
    const campaign = await createPublishedCampaign(token)
    const paused = await app.inject({
      method: 'POST',
      url: `/api/admin/campaigns/${campaign.id}/pause`,
      payload: { id: campaign.id, expectedVersion: 1, reason: 'e2e 暂停' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(paused.statusCode).toBe(200)
    const user = await userToken()
    const claim = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/claim`,
      payload: { id: campaign.id, expectedVersion: 1 },
      headers: { authorization: `Bearer ${user}`, 'idempotency-key': randomUUID() },
    })
    expect(claim.statusCode).toBe(409)
    expect(claim.json().code).toBe('CAMPAIGN_PAUSED')
  })

  it('重复领取返回已有结果且不重复发放', async () => {
    const token = await adminToken()
    const campaign = await createPublishedCampaign(token)
    const user = await userToken()
    const key = randomUUID()
    const first = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/claim`,
      payload: { id: campaign.id, expectedVersion: 1 },
      headers: { authorization: `Bearer ${user}`, 'idempotency-key': key },
    })
    const replay = await app.inject({
      method: 'POST',
      url: `/api/campaigns/${campaign.id}/claim`,
      payload: { id: campaign.id, expectedVersion: 1 },
      headers: { authorization: `Bearer ${user}`, 'idempotency-key': key },
    })
    expect(first.statusCode).toBe(200)
    expect(replay.statusCode).toBe(200)
    expect(replay.json().claim.claimId).toBe(first.json().claim.claimId)
    const balance = await app.inject({
      method: 'GET',
      url: '/api/credits/balance',
      headers: { authorization: `Bearer ${user}` },
    })
    expect(balance.json().available).toBe(5)
  })

  it('运营概览来自服务端聚合', async () => {
    const token = await adminToken()
    const overview = await app.inject({
      method: 'GET',
      url: '/api/admin/overview',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(overview.statusCode).toBe(200)
    expect(overview.json().campaigns.publishedCount).toBeGreaterThanOrEqual(1)
    // ai.enabled 取决于套件执行顺序(计费 e2e 会开启),只验证聚合结构。
    expect(typeof overview.json().ai.enabled).toBe('boolean')
  })

  it('拒绝把最后一名超级管理员降级为其他角色', async () => {
    const token = await adminToken()
    const supers = await pool.query(
      `select user_id from admin_roles where role = 'super_admin' order by user_id`,
    )
    if (supers.rows.length !== 1) {
      expect(supers.rows.length).toBeGreaterThan(1)
      return
    }
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/roles',
      payload: {
        userId: supers.rows[0].user_id,
        role: 'viewer',
        reason: 'e2e 尝试降级最后一名超管',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error?.code ?? response.json().code).toBe('ADMIN_LAST_SUPER_ADMIN')
    expect(String(response.json().error?.message ?? response.json().message)).toContain(
      '不能降级最后一名超级管理员',
    )
    const still = await pool.query(`select role from admin_roles where user_id = $1`, [
      supers.rows[0].user_id,
    ])
    expect(still.rows[0].role).toBe('super_admin')
  })

  it('两名超管并发降级后仍保留至少一名', async () => {
    const tokenA = await adminToken()
    const accountB = `e2e_super_b_${randomUUID().slice(0, 8)}`
    await registerAndLogin(accountB)
    const userA = await pool.query(
      `select u.id from users u join auth_identities i on i.user_id = u.id where i.provider_subject = $1`,
      [adminAccount],
    )
    const userB = await pool.query(
      `select u.id from users u join auth_identities i on i.user_id = u.id where i.provider_subject = $1`,
      [accountB],
    )
    const grantB = await app.inject({
      method: 'POST',
      url: '/api/admin/roles',
      payload: { userId: userB.rows[0].id, role: 'super_admin', reason: 'e2e 第二名超管' },
      headers: { authorization: `Bearer ${tokenA}` },
    })
    expect(grantB.statusCode).toBe(200)
    const others = await pool.query(
      `select user_id from admin_roles where role = 'super_admin' and user_id not in ($1, $2)`,
      [userA.rows[0].id, userB.rows[0].id],
    )
    await pool.query(
      `update admin_roles set role = 'publisher' where role = 'super_admin' and user_id not in ($1, $2)`,
      [userA.rows[0].id, userB.rows[0].id],
    )
    try {
      const tokenB = await registerAndLogin(accountB)
      const [demoteA, demoteB] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/admin/roles',
          payload: { userId: userA.rows[0].id, role: 'publisher', reason: 'e2e 并发降级 A' },
          headers: { authorization: `Bearer ${tokenB}` },
        }),
        app.inject({
          method: 'POST',
          url: '/api/admin/roles',
          payload: { userId: userB.rows[0].id, role: 'publisher', reason: 'e2e 并发降级 B' },
          headers: { authorization: `Bearer ${tokenA}` },
        }),
      ])
      const remaining = await pool.query(
        `select count(*)::int as count from admin_roles
         where role = 'super_admin' and user_id in ($1, $2)`,
        [userA.rows[0].id, userB.rows[0].id],
      )
      expect(remaining.rows[0].count).toBeGreaterThanOrEqual(1)
      expect([demoteA.statusCode, demoteB.statusCode].every((code) => code === 200)).toBe(false)
    } finally {
      for (const row of others.rows) {
        await pool.query(`update admin_roles set role = 'super_admin' where user_id = $1`, [
          row.user_id,
        ])
      }
    }
  })
})
