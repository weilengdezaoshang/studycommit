import { describe, expect, it } from 'vitest'
import {
  campaignClaimStateSchema,
  campaignDraftConfigSchema,
  campaignsClaimOutputSchema,
  campaignsListOutputSchema,
} from './campaigns.js'

function buildConfig(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: '新学期限时领取',
    grantCredits: 20,
    creditValidityDays: 90,
    fixedExpiresAt: null,
    perUserLimit: 1,
    startsAt: '2026-09-01T00:00:00+08:00',
    endsAt: '2026-10-01T00:00:00+08:00',
    platforms: ['desktop', 'mobile'],
    eligibility: {
      verifiedFrom: null,
      verifiedTo: null,
      providers: ['phone', 'account'],
      requireActiveAccount: true,
    },
    copy: {
      title: '新学期福利',
      description: '领取学习积分,兑换 Agent 解释生成',
      successMessage: '领取成功,积分已到账',
    },
    ...overrides,
  }
}

describe('campaign contract', () => {
  it('合法活动规则通过校验并保留展示文案', () => {
    const config = campaignDraftConfigSchema.parse(buildConfig())
    expect(config.grantCredits).toBe(20)
    expect(config.copy.title).toBe('新学期福利')
  })

  it('creditValidityDays 与 fixedExpiresAt 同时缺省被拒绝', () => {
    expect(
      campaignDraftConfigSchema.safeParse(
        buildConfig({ creditValidityDays: null, fixedExpiresAt: null }),
      ).success,
    ).toBe(false)
  })

  it('creditValidityDays 与 fixedExpiresAt 同时设置被拒绝', () => {
    expect(
      campaignDraftConfigSchema.safeParse(
        buildConfig({ fixedExpiresAt: '2026-12-31T00:00:00+08:00' }),
      ).success,
    ).toBe(false)
  })

  it('startsAt 晚于 endsAt 被拒绝', () => {
    expect(
      campaignDraftConfigSchema.safeParse(buildConfig({ startsAt: '2026-11-01T00:00:00+08:00' }))
        .success,
    ).toBe(false)
  })

  it('领取结果允许 granted 与待补偿两种状态', () => {
    const now = new Date().toISOString()
    const output = campaignsClaimOutputSchema.parse({
      claim: {
        claimId: crypto.randomUUID(),
        status: 'granted',
        grantedCredits: 20,
        expiresAt: now,
        version: 1,
      },
      balance: { available: 20, reserved: 0 },
    })
    expect(output.claim.status).toBe('granted')
    expect(
      campaignsClaimOutputSchema.safeParse({
        claim: {
          claimId: crypto.randomUUID(),
          status: 'pending_compensation',
          grantedCredits: null,
          expiresAt: null,
          version: 1,
        },
        balance: { available: 0, reserved: 0 },
      }).success,
    ).toBe(true)
  })

  it('活动列表输出要求展示状态与领取状态成对出现', () => {
    const output = campaignsListOutputSchema.parse({
      serverNow: '2026-09-16T08:00:00+08:00',
      campaigns: [
        {
          id: crypto.randomUUID(),
          code: 'welcome-2026',
          type: 'limited_claim',
          name: '新学期限时领取',
          displayStatus: 'active',
          claimState: campaignClaimStateSchema.parse('claimable'),
          version: 1,
          startsAt: '2026-09-01T00:00:00+08:00',
          endsAt: '2026-10-01T00:00:00+08:00',
          grantCredits: 20,
          creditValidityDays: 90,
          fixedExpiresAt: null,
          platforms: ['desktop'],
          copy: {
            title: '新学期福利',
            description: '领取学习积分,兑换 Agent 解释生成',
            successMessage: '领取成功,积分已到账',
          },
        },
      ],
    })
    expect(output.campaigns[0].displayStatus).toBe('active')
  })
})
