import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { applyTestEnv, testEnv } from '../helpers/env'
import type { DatabaseService } from '../../src/database/database.service'
import type { PinoLogger } from 'nestjs-pino'
import { CreditsRepository } from '../../src/credits/credits.repository'
import { CreditsService } from '../../src/credits/credits.service'
import { CampaignsRepository } from '../../src/campaigns/campaigns.repository'
import { CampaignsService } from '../../src/campaigns/campaigns.service'
import { CAMPAIGN_ERROR } from '../../src/campaigns/campaigns.constants'
import type { CampaignDraftConfig } from '@studycommit/rpc-contracts/campaigns'

/**
 * 活动领取集成测试:真实 PostgreSQL 上验证资格/预算/版本/幂等与注册奖励绑定。
 * 预算竞争与重复领取依赖 campaigns 行锁 + campaign_claims 唯一约束。
 */

const silentLogger = {
  setContext: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as PinoLogger

function buildConfig(overrides: Partial<CampaignDraftConfig> = {}): CampaignDraftConfig {
  const now = Date.now()
  return {
    name: '集成测试活动',
    grantCredits: 1,
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
      title: '限时领取',
      description: '领取学习积分',
      successMessage: '领取成功',
    },
    ...overrides,
  }
}

describe('活动领取与注册奖励(真实 PostgreSQL)', () => {
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL, max: 16 })
  let credits: CreditsService
  let campaigns: CampaignsService
  let actorUserId: string

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const database = { db: drizzle(pool) } as unknown as DatabaseService
    const creditsRepo = new CreditsRepository(database)
    credits = new CreditsService(creditsRepo, silentLogger)
    const campaignsRepo = new CampaignsRepository(database)
    campaigns = new CampaignsService(campaignsRepo, credits, creditsRepo, silentLogger)
    actorUserId = randomUUID()
    await pool.query(`insert into users (id) values ($1)`, [actorUserId])
  })

  afterAll(async () => {
    await pool.end()
  })

  const insertUser = async () => {
    const userId = randomUUID()
    await pool.query(`insert into users (id) values ($1)`, [userId])
    return userId
  }

  /** 创建并发布一个 limited_claim 活动,返回 campaignId 与发布版本号。 */
  const createPublishedCampaign = async (
    overrides: {
      config?: Partial<CampaignDraftConfig>
      totalBudgetCredits?: number | null
      totalClaimLimit?: number | null
    } = {},
  ) => {
    const created = await campaigns.createDraft({
      code: `it-${randomUUID().slice(0, 12)}`,
      type: 'limited_claim',
      totalBudgetCredits: overrides.totalBudgetCredits ?? null,
      totalClaimLimit: overrides.totalClaimLimit ?? null,
      config: buildConfig(overrides.config),
      actor: { actorUserId, reason: '集成测试创建' },
    })
    if (!created.ok) {
throw new Error(`创建草稿失败: ${JSON.stringify(created)}`)
}
    const published = await campaigns.publish({
      campaignId: created.campaign.id,
      expectedVersion: 0,
      actor: { actorUserId, reason: '集成测试发布' },
    })
    if (!published.ok) {
throw new Error(`发布失败: ${JSON.stringify(published)}`)
}
    return { campaignId: created.campaign.id, version: published.version }
  }

  it('剩余预算只够一人时,多个用户并发领取不超预算且结果稳定', async () => {
    const { campaignId, version } = await createPublishedCampaign({ totalBudgetCredits: 3 })
    const claimants = await Promise.all(Array.from({ length: 10 }, () => insertUser()))
    const results = await Promise.all(
      claimants.map((userId) =>
        campaigns.claim({
          userId,
          campaignId,
          expectedVersion: version,
          idempotencyKey: randomUUID(),
        }),
      ),
    )
    const granted = results.filter((row) => row.ok && row.status === 'granted')
    const exhausted = results.filter(
      (row) => !row.ok && row.code === CAMPAIGN_ERROR.budgetExhausted.code,
    )
    expect(granted).toHaveLength(3)
    expect(exhausted).toHaveLength(7)
    const totals = await pool.query(
      `select total_granted_credits, total_claim_count from campaigns where id = $1`,
      [campaignId],
    )
    expect(Number(totals.rows[0].total_granted_credits)).toBe(3)
    expect(Number(totals.rows[0].total_claim_count)).toBe(3)
  })

  it('同账号重复领取只发放一笔,重复请求返回同一领取结果', async () => {
    const { campaignId, version } = await createPublishedCampaign()
    const userId = await insertUser()
    const key = randomUUID()
    const first = await campaigns.claim({
      userId,
      campaignId,
      expectedVersion: version,
      idempotencyKey: key,
    })
    expect(first.ok).toBe(true)
    const replay = await campaigns.claim({
      userId,
      campaignId,
      expectedVersion: version,
      idempotencyKey: key,
    })
    expect(replay.ok).toBe(true)
    if (first.ok && replay.ok) {
      expect(replay.claimId).toBe(first.claimId)
    }
    const differentKey = await campaigns.claim({
      userId,
      campaignId,
      expectedVersion: version,
      idempotencyKey: randomUUID(),
    })
    expect(differentKey.ok).toBe(true)
    if (differentKey.ok) {
      expect(differentKey.claimId).toBe(first.ok ? first.claimId : '')
    }
    const grants = await pool.query(
      `select count(*)::int as count from credit_grants where user_id = $1 and campaign_id = $2`,
      [userId, campaignId],
    )
    expect(grants.rows[0].count).toBe(1)
  })

  it('同一幂等键用于不同活动返回冲突', async () => {
    const first = await createPublishedCampaign()
    const second = await createPublishedCampaign()
    const userId = await insertUser()
    const key = randomUUID()
    const grantedFirst = await campaigns.claim({
      userId,
      campaignId: first.campaignId,
      expectedVersion: first.version,
      idempotencyKey: key,
    })
    expect(grantedFirst.ok).toBe(true)
    const conflict = await campaigns.claim({
      userId,
      campaignId: second.campaignId,
      expectedVersion: second.version,
      idempotencyKey: key,
    })
    expect(conflict.ok).toBe(false)
    if (!conflict.ok) {
      expect(conflict.code).toBe(CAMPAIGN_ERROR.idempotencyConflict.code)
    }
  })

  it('版本过期与发布新版本:冲突被拒绝且版本变更不重置每人领取次数', async () => {
    const { campaignId, version } = await createPublishedCampaign()
    const userId = await insertUser()
    const stale = await campaigns.claim({
      userId,
      campaignId,
      expectedVersion: version + 5,
      idempotencyKey: randomUUID(),
    })
    expect(stale.ok).toBe(false)
    if (!stale.ok) {
      expect(stale.code).toBe(CAMPAIGN_ERROR.versionConflict.code)
    }
    const claimed = await campaigns.claim({
      userId,
      campaignId,
      expectedVersion: version,
      idempotencyKey: randomUUID(),
    })
    expect(claimed.ok).toBe(true)
    // 规则变更必须发布新版本;新版本下同一用户仍然只能领一次。
    const republished = await campaigns.publish({
      campaignId,
      expectedVersion: version,
      actor: { actorUserId, reason: '发布新版本' },
    })
    expect(republished.ok).toBe(true)
    const again = await campaigns.claim({
      userId,
      campaignId,
      expectedVersion: version + 1,
      idempotencyKey: randomUUID(),
    })
    expect(again.ok).toBe(true)
    if (again.ok) {
      expect(again.claimId).toBe(claimed.ok ? claimed.claimId : '')
    }
  })

  it('暂停后不再受理新领取', async () => {
    const { campaignId, version } = await createPublishedCampaign()
    const paused = await campaigns.transition({
      campaignId,
      expectedVersion: version,
      action: 'pause',
      actor: { actorUserId, reason: '暂停活动' },
    })
    expect(paused.ok).toBe(true)
    const userId = await insertUser()
    const claim = await campaigns.claim({
      userId,
      campaignId,
      expectedVersion: version,
      idempotencyKey: randomUUID(),
    })
    expect(claim.ok).toBe(false)
    if (!claim.ok) {
      expect(claim.code).toBe(CAMPAIGN_ERROR.paused.code)
    }
  })

  it('时间边界之外拒绝领取:未开始与已结束', async () => {
    const userId = await insertUser()
    const notStarted = await createPublishedCampaign({
      config: {
        startsAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        endsAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
      },
    })
    const early = await campaigns.claim({
      userId,
      campaignId: notStarted.campaignId,
      expectedVersion: notStarted.version,
      idempotencyKey: randomUUID(),
    })
    expect(early.ok).toBe(false)
    if (!early.ok) {
      expect(early.code).toBe(CAMPAIGN_ERROR.notStarted.code)
    }
    const ended = await createPublishedCampaign({
      config: {
        endsAt: new Date(Date.now() - 60_000).toISOString(),
        startsAt: new Date(Date.now() - 120_000).toISOString(),
      },
    })
    const late = await campaigns.claim({
      userId,
      campaignId: ended.campaignId,
      expectedVersion: ended.version,
      idempotencyKey: randomUUID(),
    })
    expect(late.ok).toBe(false)
    if (!late.ok) {
      expect(late.code).toBe(CAMPAIGN_ERROR.ended.code)
    }
  })

  it('注册奖励:事件消费发放一笔,重复消费幂等', async () => {
    // 隔离:清理历史遗留注册活动数据,保证只有本用例新建的活动可消费事件。
    await pool.query(
      `delete from credit_grants where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(
      `delete from campaign_versions where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(
      `delete from campaign_claims where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(`delete from campaigns where type = 'registration_bonus'`)
    const created = await campaigns.createDraft({
      code: `reg-${randomUUID().slice(0, 12)}`,
      type: 'registration_bonus',
      totalBudgetCredits: null,
      totalClaimLimit: null,
      config: buildConfig(),
      actor: { actorUserId, reason: '注册奖励测试' },
    })
    if (!created.ok) {
throw new Error('创建注册活动失败')
}
    const published = await campaigns.publish({
      campaignId: created.campaign.id,
      expectedVersion: 0,
      actor: { actorUserId, reason: '发布注册活动' },
    })
    expect(published.ok).toBe(true)

    const userId = await insertUser()
    const result = await campaigns.consumeRegistrationEvent({
      userId,
      provider: 'phone',
      verifiedAt: new Date().toISOString(),
    })
    expect(result?.granted).toBe(true)
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(1)
    const replay = await campaigns.consumeRegistrationEvent({
      userId,
      provider: 'phone',
      verifiedAt: new Date().toISOString(),
    })
    // 全局一次语义:重复事件不再产生新发放或新领取记录。
    expect(replay).toBeNull()
    const claims = await pool.query(
      `select count(*)::int as count from campaign_claims where user_id = $1 and campaign_id = $2`,
      [userId, created.campaign.id],
    )
    expect(claims.rows[0].count).toBe(1)
    const afterReplay = await credits.getBalance(userId)
    expect(afterReplay.available).toBe(1)
  })

  it('注册奖励:消费时活动已暂停则保留待补偿资格且不发放', async () => {
    // 隔离:清理历史遗留注册活动数据,保证只有本用例新建的活动可消费事件。
    await pool.query(
      `delete from credit_grants where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(
      `delete from campaign_versions where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(
      `delete from campaign_claims where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(`delete from campaigns where type = 'registration_bonus'`)
    const created = await campaigns.createDraft({
      code: `reg-paused-${randomUUID().slice(0, 12)}`,
      type: 'registration_bonus',
      totalBudgetCredits: null,
      totalClaimLimit: null,
      config: buildConfig(),
      actor: { actorUserId, reason: '暂停注册活动测试' },
    })
    if (!created.ok) {
throw new Error('创建失败')
}
    await campaigns.publish({
      campaignId: created.campaign.id,
      expectedVersion: 0,
      actor: { actorUserId, reason: '发布' },
    })
    await campaigns.transition({
      campaignId: created.campaign.id,
      expectedVersion: 1,
      action: 'pause',
      actor: { actorUserId, reason: '暂停' },
    })
    const userId = await insertUser()
    const result = await campaigns.consumeRegistrationEvent({
      userId,
      provider: 'phone',
      verifiedAt: new Date().toISOString(),
    })
    expect(result?.granted).toBe(false)
    const balance = await credits.getBalance(userId)
    expect(balance.available).toBe(0)
    const claims = await pool.query(
      `select status from campaign_claims where user_id = $1 and campaign_id = $2`,
      [userId, created.campaign.id],
    )
    expect(claims.rows[0].status).toBe('pending_compensation')
  })

  it('注册奖励活动不支持手动领取', async () => {
    // 隔离:清理历史遗留注册活动数据,保证只有本用例新建的活动可消费事件。
    await pool.query(
      `delete from credit_grants where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(
      `delete from campaign_versions where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(
      `delete from campaign_claims where campaign_id in (select id from campaigns where type = 'registration_bonus')`,
    )
    await pool.query(`delete from campaigns where type = 'registration_bonus'`)
    const created = await campaigns.createDraft({
      code: `reg-manual-${randomUUID().slice(0, 12)}`,
      type: 'registration_bonus',
      totalBudgetCredits: null,
      totalClaimLimit: null,
      config: buildConfig(),
      actor: { actorUserId, reason: '手动领取拒绝测试' },
    })
    if (!created.ok) {
throw new Error('创建失败')
}
    await campaigns.publish({
      campaignId: created.campaign.id,
      expectedVersion: 0,
      actor: { actorUserId, reason: '发布' },
    })
    const userId = await insertUser()
    const claim = await campaigns.claim({
      userId,
      campaignId: created.campaign.id,
      expectedVersion: 1,
      idempotencyKey: randomUUID(),
    })
    expect(claim.ok).toBe(false)
    if (!claim.ok) {
      expect(claim.code).toBe(CAMPAIGN_ERROR.registrationNotClaimable.code)
    }
  })

  it('注册事件绑定注册事务:createPhoneUser 同事务写入 outbox 事件', async () => {
    const database = { db: drizzle(pool) } as unknown as DatabaseService
    const { AuthRepository } = await import('../../src/auth/auth.repository')
    const authRepository = new AuthRepository(database)
    const subject = `it-phone-${randomUUID().slice(0, 8)}`
    const user = await authRepository.createPhoneUser(subject)
    expect(user).not.toBeNull()
    const events = await pool.query(
      `select payload from outbox_events where payload->>'userId' = $1 and type = 'auth.user_verified'`,
      [user!.id],
    )
    expect(events.rows).toHaveLength(1)
    expect(events.rows[0].payload.provider).toBe('phone')
  })
})
