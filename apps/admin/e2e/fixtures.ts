/** Playwright 专用 mock fixture,默认应用不会加载这些数据. */
import type { CampaignDraftConfig } from '../src/services/types'

export const IDS = {
  user: '22222222-2222-4222-8222-222222222222',
  admin: '11111111-1111-4111-8111-111111111111',
  campaign: '33333333-3333-4333-8333-333333333333',
  claim: '44444444-4444-4444-8444-444444444444',
  run: '55555555-5555-4555-8555-555555555555',
  grant: '66666666-6666-4666-8666-666666666666',
  audit: '77777777-7777-4777-8777-777777777777',
}

export const loginResponse = {
  user: {
    id: IDS.admin,
    nickname: '管理员',
    avatarUrl: null,
    status: 'active',
  },
  tokens: {
    accessToken: 'memory-access-token',
    refreshToken: 'memory-refresh-token',
    expiresAt: '2026-09-18T12:00:00+08:00',
  },
}

export const meSuperAdmin = { userId: IDS.admin, role: 'super_admin' }
export const meViewer = { userId: IDS.admin, role: 'viewer' }

const draftConfig: CampaignDraftConfig = {
  name: '秋日学习计划',
  grantCredits: 100,
  creditValidityDays: 30,
  fixedExpiresAt: null,
  perUserLimit: 1,
  startsAt: '2026-09-18T00:00:00+08:00',
  endsAt: '2026-09-30T23:59:00+08:00',
  platforms: ['desktop', 'mobile'],
  eligibility: {
    verifiedFrom: null,
    verifiedTo: null,
    providers: null,
    requireActiveAccount: true,
  },
  copy: {
    title: '秋日学习计划',
    description: '迎接秋天，坚持学习',
    successMessage: '已领取 100 积分',
  },
}

export const overview = {
  serverNow: '2026-09-18T10:32:00+08:00',
  campaigns: { publishedCount: 3, totalGrantedCredits: 24800, totalClaimCount: 248 },
  ai: {
    enabled: true,
    activePriceVersion: 3,
    runs: { pending: 12, completedToday: 286, failedToday: 8, longFrozen: 3 },
    cost: { reservedToday: '16.60', confirmedToday: '128.40', dailyBudget: '500.00' },
  },
  credits: { reservedTotal: 60, pendingCompensationCount: 2 },
}

export const campaignList = {
  items: [
    {
      id: IDS.campaign,
      code: 'autumn-2026',
      type: 'limited_claim',
      name: '秋日学习计划',
      status: 'published',
      displayStatus: 'active',
      version: 3,
      currentVersion: 3,
      startsAt: draftConfig.startsAt,
      endsAt: draftConfig.endsAt,
      grantCredits: 100,
      creditValidityDays: 30,
      fixedExpiresAt: null,
      platforms: ['desktop', 'mobile'],
      copy: draftConfig.copy,
      totalGrantedCredits: 12400,
      totalClaimCount: 124,
      totalBudgetCredits: 20000,
      totalClaimLimit: 200,
      displayTimezone: 'Asia/Shanghai',
      createdAt: '2026-09-01T00:00:00+08:00',
      updatedAt: '2026-09-18T10:00:00+08:00',
    },
  ],
  nextCursor: 'campaign-cursor-2',
}

export const campaignDetail = {
  ...campaignList.items[0],
  versions: [
    {
      version: 3,
      config: draftConfig,
      eligibilityVersion: 3,
      createdAt: '2026-09-18T10:00:00+08:00',
    },
  ],
  draftConfig,
}

export const claimsPage = {
  items: [
    {
      claimId: IDS.claim,
      userId: IDS.user,
      version: 3,
      status: 'pending_compensation',
      grantedCredits: null,
      idempotencyKey: null,
      createdAt: '2026-09-18T09:32:00+08:00',
    },
  ],
  nextCursor: null,
}

export const runsPage = {
  items: [
    {
      runId: IDS.run,
      userId: IDS.user,
      kind: 'paper_explain',
      status: 'failed',
      reservation: {
        reservationId: '88888888-8888-4888-8888-888888888888',
        status: 'active',
        amount: 5,
        deadlineAt: '2026-09-17T10:00:00+08:00',
      },
      error: '供应商响应超时',
      createdAt: '2026-09-17T08:21:33+08:00',
    },
  ],
  nextCursor: null,
}

export const creditUsers = {
  items: [
    {
      userId: IDS.user,
      nickname: '林同学',
      available: 195,
      reserved: 5,
      lifetimeGranted: 200,
    },
  ],
}

export const creditUserDetail = {
  user: creditUsers.items[0],
  grants: [
    {
      grantId: IDS.grant,
      source: 'campaign',
      campaignId: IDS.campaign,
      originalAmount: 100,
      remainingAvailable: 95,
      frozenAmount: 5,
      status: 'active',
      expiresAt: '2026-10-10T00:00:00+08:00',
      createdAt: '2026-09-10T00:00:00+08:00',
    },
  ],
}

export const ledgerPage = {
  items: [
    {
      eventId: 'evt-1',
      userId: IDS.user,
      kind: 'grant',
      deltaAvailable: 100,
      deltaReserved: 0,
      grantId: IDS.grant,
      reservationId: null,
      runId: null,
      campaignId: IDS.campaign,
      createdAt: '2026-09-10T10:00:00+08:00',
    },
    {
      eventId: 'evt-2',
      userId: IDS.user,
      kind: 'reserve',
      deltaAvailable: -5,
      deltaReserved: 5,
      grantId: IDS.grant,
      reservationId: null,
      runId: IDS.run,
      campaignId: null,
      createdAt: '2026-09-12T14:20:00+08:00',
    },
  ],
  nextCursor: null,
}

export const aiConfig = {
  aiEnabled: true,
  featureFlags: { paper_explain: true },
  costProtectionEnabled: true,
  dailyCostBudget: '500.0000',
  version: 8,
  updatedAt: '2026-09-18T10:32:00+08:00',
}

export const aiProvider = {
  displayStatus: 'configured_unverified' as const,
  protocol: 'openai' as const,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-test',
  hasApiKey: true,
  apiKeyHint: '••••test',
  lastTestStatus: 'unverified' as const,
  lastTestedAt: null,
  billedModel: 'active-model',
  envFallbackActive: false,
  version: 2,
  lastOperationId: null,
  updatedAt: '2026-09-18T10:32:00+08:00',
}

export const prices = {
  items: [
    {
      id: '99999999-9999-4999-8999-999999999999',
      action: 'paper_explain',
      version: 3,
      priceCredits: 5,
      configSnapshot: {
        model: 'active-model',
        maxInputTokens: 20000,
        maxOutputTokens: 4000,
        estimatedCostPerRun: '0.010000',
        currency: 'CNY',
      },
      isActive: true,
      publishedAt: '2026-09-18T09:00:00+08:00',
      createdAt: '2026-09-18T09:00:00+08:00',
    },
  ],
}

export const auditLogs = {
  items: [
    {
      id: IDS.audit,
      actorUserId: IDS.admin,
      action: 'campaign.publish',
      targetType: 'campaign',
      targetId: IDS.campaign,
      reason: '新学期活动上线',
      requestId: 'req-9f3a',
      createdAt: '2026-09-18T10:20:00+08:00',
    },
  ],
  nextCursor: null,
}

export const roles = {
  items: [
    {
      userId: IDS.admin,
      role: 'super_admin',
      grantedBy: null,
      reason: '初始管理员',
      createdAt: '2026-08-01T10:24:00+08:00',
    },
  ],
}
