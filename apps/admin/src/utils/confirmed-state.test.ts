import { expect, it } from 'vitest'
import { matchesConfigPatch, matchesProviderConfig, sameDraftConfig } from './confirmed-state'
import type { AiServiceConfig, CampaignDraftConfig } from '@/services/types'

it('服务商查询确认要求协议、地址与模型一致', () => {
  const actual = {
    displayStatus: 'configured_unverified' as const,
    protocol: 'openai' as const,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-test',
    hasApiKey: true,
    apiKeyHint: '••••test',
    lastTestStatus: 'unverified' as const,
    lastTestedAt: null,
    billedModel: null,
    envFallbackActive: false,
    version: 2,
    updatedAt: '2026-09-18T00:00:00Z',
  }
  expect(
    matchesProviderConfig(actual, {
      protocol: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-test',
      displayStatus: 'configured_unverified',
    }),
  ).toBe(true)
  expect(
    matchesProviderConfig(actual, {
      protocol: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'other',
      displayStatus: 'configured_unverified',
    }),
  ).toBe(false)
})

it('其他配置发生变化时不能误判目标开关已修改', () => {
  const actual: AiServiceConfig = {
    aiEnabled: true,
    featureFlags: {},
    costProtectionEnabled: true,
    dailyCostBudget: '500.0000',
    version: 9,
    updatedAt: '2026-09-18T00:00:00Z',
  }
  expect(matchesConfigPatch(actual, { aiEnabled: false })).toBe(false)
  expect(matchesConfigPatch(actual, { dailyCostBudget: '500' })).toBe(true)
})

it('草稿结果核对兼容等价时区表示但拒绝不同资格', () => {
  const expected: CampaignDraftConfig = {
    name: '内部名称',
    grantCredits: 100,
    creditValidityDays: 30,
    fixedExpiresAt: null,
    perUserLimit: 1,
    startsAt: '2026-09-18T08:00:00+08:00',
    endsAt: '2026-09-30T08:00:00+08:00',
    platforms: ['desktop'],
    eligibility: {
      verifiedFrom: null,
      verifiedTo: null,
      providers: ['phone'],
      requireActiveAccount: true,
    },
    copy: { title: '公开标题', description: '说明', successMessage: '成功' },
  }
  expect(sameDraftConfig({ ...expected, startsAt: '2026-09-18T00:00:00Z' }, expected)).toBe(true)
  expect(
    sameDraftConfig(
      { ...expected, eligibility: { ...expected.eligibility, providers: null } },
      expected,
    ),
  ).toBe(false)
})
