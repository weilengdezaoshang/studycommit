import { describe, expect, it } from 'vitest'
import {
  adminAiProviderConfigSchema,
  adminAiPublishPriceInputSchema,
  adminAiUpdateProviderInputSchema,
  adminCampaignCreateInputSchema,
} from './admin.js'
import { apiContract } from './contract.js'

function buildDraftConfig() {
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
      providers: null,
      requireActiveAccount: true,
    },
    copy: {
      title: '新学期福利',
      description: '领取学习积分,兑换 Agent 解释生成',
      successMessage: '领取成功,积分已到账',
    },
  }
}

describe('admin contract', () => {
  it('聚合进 apiContract 且包含活动/定价/审计域', () => {
    expect(Object.keys(apiContract.admin)).toEqual([
      'access',
      'campaigns',
      'ai',
      'credits',
      'audit',
    ])
  })

  it('创建活动草稿要求 code 小写连字符格式与完整规则', () => {
    const parsed = adminCampaignCreateInputSchema.parse({
      code: 'welcome-2026',
      type: 'limited_claim',
      totalBudgetCredits: 10_000,
      totalClaimLimit: 500,
      displayTimezone: 'Asia/Shanghai',
      config: buildDraftConfig(),
      reason: '新学期运营活动',
    })
    expect(parsed.code).toBe('welcome-2026')
    expect(
      adminCampaignCreateInputSchema.safeParse({
        code: 'Welcome 2026',
        type: 'limited_claim',
        totalBudgetCredits: null,
        totalClaimLimit: null,
        displayTimezone: 'Asia/Shanghai',
        config: buildDraftConfig(),
        reason: '大写与空格不合法',
      }).success,
    ).toBe(false)
  })

  it('未配置服务商视图允许版本 0', () => {
    expect(
      adminAiProviderConfigSchema.safeParse({
        displayStatus: 'unconfigured',
        protocol: null,
        baseUrl: null,
        model: null,
        hasApiKey: false,
        apiKeyHint: null,
        lastTestStatus: null,
        lastTestedAt: null,
        billedModel: null,
        envFallbackActive: false,
        version: 0,
        updatedAt: null,
      }).success,
    ).toBe(true)
  })

  it('保存服务商配置要求操作原因且密钥可留空', () => {
    expect(
      adminAiUpdateProviderInputSchema.safeParse({
        expectedVersion: 1,
        protocol: 'openai',
        model: 'gpt-test',
        reason: '首次接入平台密钥',
      }).success,
    ).toBe(true)
    expect(
      adminAiUpdateProviderInputSchema.safeParse({
        expectedVersion: 1,
        protocol: 'openai',
        model: 'gpt-test',
        apiKey: 'sk-not-real',
      }).success,
    ).toBe(false)
  })

  it('发布价格要求固定精度的成本估算字符串', () => {
    expect(
      adminAiPublishPriceInputSchema.safeParse({
        action: 'paper_explain',
        priceCredits: 5,
        configSnapshot: {
          model: 'gpt-test',
          maxInputTokens: 20_000,
          maxOutputTokens: 4_000,
          estimatedCostPerRun: '0.012500',
          currency: 'CNY',
        },
        reason: '首版定价',
      }).success,
    ).toBe(true)
    expect(
      adminAiPublishPriceInputSchema.safeParse({
        action: 'paper_explain',
        priceCredits: 5,
        configSnapshot: {
          model: 'gpt-test',
          maxInputTokens: 20_000,
          maxOutputTokens: 4_000,
          estimatedCostPerRun: '0.01.2',
          currency: 'CNY',
        },
        reason: '非法小数',
      }).success,
    ).toBe(false)
  })
})
