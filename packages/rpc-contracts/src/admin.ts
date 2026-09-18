import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  campaignClaimStatusSchema,
  campaignDraftConfigSchema,
  campaignSummarySchema,
  campaignTypeSchema,
} from './campaigns.js'
import { creditsLedgerEntrySchema } from './credits.js'

/**
 * 管理端契约:仅供具备管理角色的会话访问,后端逐操作鉴权。
 * 危险动作一律携带 expectedVersion(乐观锁)与 reason(审计理由);
 * 不提供直接修改余额/流水的通用接口。
 */

export const adminRoleSchema = z.enum(['viewer', 'operator', 'publisher', 'super_admin'])
export type AdminRole = z.infer<typeof adminRoleSchema>

export const adminReasonSchema = z.string().trim().min(1).max(500)
/** 活动当前版本号;草稿为 0,发布后从 1 递增。 */
export const adminExpectedVersionSchema = z.number().int().min(0)

export const adminAccessMeOutputSchema = z.object({
  userId: z.uuid(),
  role: adminRoleSchema,
})
export type AdminAccessMeOutput = z.infer<typeof adminAccessMeOutputSchema>

export const adminGrantRoleInputSchema = z.object({
  userId: z.uuid(),
  role: adminRoleSchema,
  reason: adminReasonSchema,
})
export const adminGrantRoleOutputSchema = z.object({
  userId: z.uuid(),
  role: adminRoleSchema,
})

export const adminListRolesOutputSchema = z.object({
  items: z.array(
    z.object({
      userId: z.uuid(),
      role: adminRoleSchema,
      grantedBy: z.uuid().nullable(),
      reason: z.string().nullable(),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  ),
})
export type AdminListRolesOutput = z.infer<typeof adminListRolesOutputSchema>

export const adminCampaignStatusSchema = z.enum(['draft', 'published', 'paused', 'ended'])

export const adminCampaignSummarySchema = campaignSummarySchema.extend({
  /** 人工状态;displayStatus 是叠加时间/额度后的展示状态。 */
  status: adminCampaignStatusSchema,
  /** 管理端可见原始版本号:草稿为 0,发布后递增。 */
  version: z.number().int().min(0),
  currentVersion: z.number().int().min(0),
  totalGrantedCredits: z.number().int().min(0),
  totalClaimCount: z.number().int().min(0),
  totalBudgetCredits: z.number().int().min(0).nullable(),
  totalClaimLimit: z.number().int().min(0).nullable(),
  displayTimezone: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type AdminCampaignSummary = z.infer<typeof adminCampaignSummarySchema>

export const adminCampaignVersionSchema = z.object({
  version: z.number().int().min(1),
  config: campaignDraftConfigSchema,
  eligibilityVersion: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
})
export type AdminCampaignVersion = z.infer<typeof adminCampaignVersionSchema>

export const adminCampaignDetailSchema = adminCampaignSummarySchema.extend({
  versions: z.array(adminCampaignVersionSchema),
  draftConfig: campaignDraftConfigSchema.nullable(),
})
export type AdminCampaignDetail = z.infer<typeof adminCampaignDetailSchema>

export const adminPaginatedMetaSchema = z.object({
  nextCursor: z.string().nullable(),
})
export type AdminPaginatedMeta = z.infer<typeof adminPaginatedMetaSchema>

export const adminCampaignListInputSchema = z.object({
  status: adminCampaignStatusSchema.nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).nullable().optional(),
})
export const adminCampaignListOutputSchema = z.object({
  items: z.array(adminCampaignSummarySchema),
  nextCursor: z.string().nullable(),
})

export const adminCampaignCreateInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'code 仅允许小写字母、数字与连字符'),
  type: campaignTypeSchema,
  totalBudgetCredits: z.number().int().min(0).max(1_000_000_000).nullable(),
  totalClaimLimit: z.number().int().min(0).max(1_000_000).nullable(),
  displayTimezone: z.string().min(1).max(64),
  config: campaignDraftConfigSchema,
  reason: adminReasonSchema,
})
export const adminCampaignCreateOutputSchema = adminCampaignSummarySchema

export const adminCampaignGetInputSchema = z.object({ id: z.uuid() })
export const adminCampaignGetOutputSchema = adminCampaignDetailSchema

export const adminCampaignUpdateDraftInputSchema = z.object({
  id: z.uuid(),
  expectedVersion: adminExpectedVersionSchema,
  config: campaignDraftConfigSchema,
  reason: adminReasonSchema,
})
export const adminCampaignUpdateDraftOutputSchema = adminCampaignSummarySchema

const adminCampaignLifecycleInputSchema = z.object({
  id: z.uuid(),
  expectedVersion: adminExpectedVersionSchema,
  reason: adminReasonSchema,
})
export const adminCampaignLifecycleOutputSchema = adminCampaignSummarySchema

export const adminCampaignClaimsInputSchema = z.object({
  id: z.uuid(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).nullable().optional(),
})
export const adminCampaignClaimsOutputSchema = z.object({
  items: z.array(
    z.object({
      claimId: z.uuid(),
      userId: z.uuid(),
      version: z.number().int().min(1),
      status: campaignClaimStatusSchema,
      grantedCredits: z.number().int().min(1).nullable(),
      idempotencyKey: z.string().nullable(),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  ),
  nextCursor: z.string().nullable(),
})

export const adminCompensateClaimInputSchema = z.object({
  id: z.uuid(),
  claimId: z.uuid(),
  reason: adminReasonSchema,
})
export const adminCompensateClaimOutputSchema = z.object({
  claimId: z.uuid(),
  status: campaignClaimStatusSchema,
  grantedCredits: z.number().int().min(1).nullable(),
})

export const adminAiServiceConfigSchema = z.object({
  aiEnabled: z.boolean(),
  featureFlags: z.record(z.string(), z.boolean()),
  costProtectionEnabled: z.boolean(),
  /** 每日供应商成本预算;null 表示未设预算(此时禁止开启计费)。 */
  dailyCostBudget: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .nullable(),
  version: z.number().int().min(1),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type AdminAiServiceConfig = z.infer<typeof adminAiServiceConfigSchema>

export const adminAiConfigOutputSchema = adminAiServiceConfigSchema

export const adminAiUpdateConfigInputSchema = z.object({
  expectedVersion: adminExpectedVersionSchema,
  aiEnabled: z.boolean().optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  costProtectionEnabled: z.boolean().optional(),
  /** 设置/修改每日成本预算;开启计费前必须已设置。 */
  dailyCostBudget: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .nullable()
    .optional(),
  reason: adminReasonSchema,
})

export const adminAiPriceSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  version: z.number().int().min(1),
  priceCredits: z.number().int().min(0),
  configSnapshot: z.object({
    model: z.string(),
    maxInputTokens: z.number().int().min(1),
    maxOutputTokens: z.number().int().min(1),
    estimatedCostPerRun: z.string(),
    currency: z.string(),
  }),
  isActive: z.boolean(),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})
export type AdminAiPrice = z.infer<typeof adminAiPriceSchema>

export const adminAiListPricesOutputSchema = z.object({
  items: z.array(adminAiPriceSchema),
})

export const adminAiPublishPriceInputSchema = z.object({
  action: z.enum(['paper_explain']),
  priceCredits: z.number().int().min(0).max(1_000_000),
  configSnapshot: z.object({
    model: z.string().min(1).max(120),
    maxInputTokens: z.number().int().min(1).max(1_000_000),
    maxOutputTokens: z.number().int().min(1).max(1_000_000),
    /** 固定精度字符串,避免 JSON 浮点误差。 */
    estimatedCostPerRun: z.string().regex(/^\d+(\.\d{1,6})?$/),
    currency: z.string().min(1).max(10),
  }),
  reason: adminReasonSchema,
})
export const adminAiPublishPriceOutputSchema = adminAiPriceSchema

export const adminOverviewOutputSchema = z.object({
  serverNow: z.iso.datetime({ offset: true }),
  campaigns: z.object({
    publishedCount: z.number().int().min(0),
    totalGrantedCredits: z.number().int().min(0),
    totalClaimCount: z.number().int().min(0),
  }),
  ai: z.object({
    enabled: z.boolean(),
    activePriceVersion: z.number().int().min(1).nullable(),
    runs: z.object({
      pending: z.number().int().min(0),
      completedToday: z.number().int().min(0),
      failedToday: z.number().int().min(0),
      longFrozen: z.number().int().min(0),
    }),
    cost: z.object({
      reservedToday: z.string(),
      confirmedToday: z.string(),
      dailyBudget: z.string().nullable(),
    }),
  }),
  credits: z.object({
    reservedTotal: z.number().int().min(0),
    pendingCompensationCount: z.number().int().min(0),
  }),
})
export type AdminOverviewOutput = z.infer<typeof adminOverviewOutputSchema>

export const adminCreditsUserSchema = z.object({
  userId: z.uuid(),
  nickname: z.string().nullable(),
  available: z.number().int().min(0),
  reserved: z.number().int().min(0),
  lifetimeGranted: z.number().int().min(0),
})

export const adminCreditsSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(80).describe('用户 ID 或昵称前缀'),
  limit: z.number().int().min(1).max(50).default(20),
})
export const adminCreditsSearchOutputSchema = z.object({
  items: z.array(adminCreditsUserSchema),
})

export const adminCreditsUserDetailInputSchema = z.object({ userId: z.uuid() })
export const adminCreditsUserDetailOutputSchema = z.object({
  user: adminCreditsUserSchema,
  grants: z.array(
    z.object({
      grantId: z.uuid(),
      source: z.enum(['campaign', 'admin_grant']),
      campaignId: z.uuid().nullable(),
      originalAmount: z.number().int().min(1),
      remainingAvailable: z.number().int().min(0),
      frozenAmount: z.number().int().min(0),
      status: z.enum(['active', 'expired']),
      expiresAt: z.iso.datetime({ offset: true }).nullable(),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  ),
})

export const adminCreditsLedgerInputSchema = z.object({
  userId: z.uuid().nullable().optional(),
  campaignId: z.uuid().nullable().optional(),
  kind: z.enum(['grant', 'reserve', 'settle', 'release', 'expire']).nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).nullable().optional(),
})
export const adminCreditsLedgerOutputSchema = z.object({
  items: z.array(creditsLedgerEntrySchema.extend({ userId: z.uuid() })),
  nextCursor: z.string().nullable(),
})

export const adminRunsInputSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed']).nullable().optional(),
  runId: z.uuid().nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).nullable().optional(),
})
export const adminRunsOutputSchema = z.object({
  items: z.array(
    z.object({
      runId: z.uuid(),
      userId: z.uuid(),
      kind: z.enum(['companion_followup', 'paper_explain']),
      status: z.enum(['pending', 'completed', 'failed']),
      /** 冻结状态:仅计费运行存在。 */
      reservation: z
        .object({
          reservationId: z.uuid(),
          status: z.enum(['active', 'settled', 'released', 'expired']),
          amount: z.number().int().min(1),
          deadlineAt: z.iso.datetime({ offset: true }),
        })
        .nullable(),
      error: z.string().nullable(),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  ),
  nextCursor: z.string().nullable(),
})

export const adminAuditLogsInputSchema = z.object({
  actorUserId: z.uuid().nullable().optional(),
  targetType: z.string().max(50).nullable().optional(),
  targetId: z.string().max(100).nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).nullable().optional(),
})
export const adminAuditLogsOutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      actorUserId: z.uuid(),
      action: z.string(),
      targetType: z.string(),
      targetId: z.string(),
      reason: z.string(),
      requestId: z.string().nullable(),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  ),
  nextCursor: z.string().nullable(),
})

export const adminAccessContract = {
  me: oc
    .route({ method: 'GET', path: '/admin/access/me', summary: '查看当前管理身份' })
    .output(adminAccessMeOutputSchema),
  listRoles: oc
    .route({ method: 'GET', path: '/admin/roles', summary: '管理员角色列表' })
    .output(adminListRolesOutputSchema),
  grantRole: oc
    .route({ method: 'POST', path: '/admin/roles', summary: '授予管理角色' })
    .input(adminGrantRoleInputSchema)
    .output(adminGrantRoleOutputSchema),
}

export const adminCampaignsContract = {
  list: oc
    .route({ method: 'GET', path: '/admin/campaigns', summary: '活动列表(含内部配置)' })
    .input(adminCampaignListInputSchema)
    .output(adminCampaignListOutputSchema),
  create: oc
    .route({ method: 'POST', path: '/admin/campaigns', summary: '创建活动草稿' })
    .input(adminCampaignCreateInputSchema)
    .output(adminCampaignCreateOutputSchema),
  get: oc
    .route({ method: 'GET', path: '/admin/campaigns/{id}', summary: '活动详情与历史版本' })
    .input(adminCampaignGetInputSchema)
    .output(adminCampaignGetOutputSchema),
  updateDraft: oc
    .route({ method: 'PUT', path: '/admin/campaigns/{id}/draft', summary: '修改活动草稿' })
    .input(adminCampaignUpdateDraftInputSchema)
    .output(adminCampaignUpdateDraftOutputSchema),
  publish: oc
    .route({ method: 'POST', path: '/admin/campaigns/{id}/publish', summary: '发布活动新版本' })
    .input(adminCampaignLifecycleInputSchema)
    .output(adminCampaignLifecycleOutputSchema),
  pause: oc
    .route({ method: 'POST', path: '/admin/campaigns/{id}/pause', summary: '暂停活动' })
    .input(adminCampaignLifecycleInputSchema)
    .output(adminCampaignLifecycleOutputSchema),
  resume: oc
    .route({ method: 'POST', path: '/admin/campaigns/{id}/resume', summary: '恢复活动' })
    .input(adminCampaignLifecycleInputSchema)
    .output(adminCampaignLifecycleOutputSchema),
  end: oc
    .route({ method: 'POST', path: '/admin/campaigns/{id}/end', summary: '结束活动' })
    .input(adminCampaignLifecycleInputSchema)
    .output(adminCampaignLifecycleOutputSchema),
  listClaims: oc
    .route({ method: 'GET', path: '/admin/campaigns/{id}/claims', summary: '活动领取记录' })
    .input(adminCampaignClaimsInputSchema)
    .output(adminCampaignClaimsOutputSchema),
  compensate: oc
    .route({ method: 'POST', path: '/admin/campaigns/{id}/compensate', summary: '补偿待处理领取' })
    .input(adminCompensateClaimInputSchema)
    .output(adminCompensateClaimOutputSchema),
}

export const adminAiProviderProtocolSchema = z.enum(['openai', 'anthropic', 'gemini'])
export type AdminAiProviderProtocol = z.infer<typeof adminAiProviderProtocolSchema>

export const adminAiProviderDisplayStatusSchema = z.enum([
  'unconfigured',
  'configured_unverified',
  'connected',
  'connection_failed',
  'disabled',
])
export type AdminAiProviderDisplayStatus = z.infer<typeof adminAiProviderDisplayStatusSchema>

/** 服务商配置对外视图:不含完整 API Key,仅返回是否已配置与脱敏标识。 */
export const adminAiProviderConfigSchema = z.object({
  displayStatus: adminAiProviderDisplayStatusSchema,
  protocol: adminAiProviderProtocolSchema.nullable(),
  baseUrl: z.string().nullable(),
  model: z.string().min(1).max(120).nullable(),
  hasApiKey: z.boolean(),
  apiKeyHint: z.string().max(32).nullable(),
  lastTestStatus: z.enum(['success', 'failed', 'unverified']).nullable(),
  lastTestedAt: z.iso.datetime({ offset: true }).nullable(),
  /** 当前生效价格快照中的计费模型;与服务商模型独立。 */
  billedModel: z.string().nullable(),
  /** 仅在尚未建立数据库配置时为 true;停用后不会回退环境变量。 */
  envFallbackActive: z.boolean(),
  /** 尚未落库为 0,首次保存后从 1 递增。 */
  version: z.number().int().min(0),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
})
export type AdminAiProviderConfig = z.infer<typeof adminAiProviderConfigSchema>

export const adminAiUpdateProviderInputSchema = z.object({
  expectedVersion: adminExpectedVersionSchema,
  protocol: adminAiProviderProtocolSchema,
  baseUrl: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1).max(120),
  /** 留空表示保持原密钥;首次保存必须提供。 */
  apiKey: z.string().max(4096).optional(),
  reason: adminReasonSchema,
})

export const adminAiDisableProviderInputSchema = z.object({
  expectedVersion: adminExpectedVersionSchema,
  reason: adminReasonSchema,
})

export const adminAiTestProviderInputSchema = z.object({
  protocol: adminAiProviderProtocolSchema,
  baseUrl: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1).max(120),
  /** 留空表示使用已保存密钥;测试不会保存表单。 */
  apiKey: z.string().max(4096).optional(),
})

export const adminAiTestProviderOutputSchema = z.object({
  ok: z.boolean(),
  code: z.enum(['connected', 'auth_failed', 'timeout', 'unsafe_url', 'rate_limited', 'failed']),
  message: z.string(),
  testedAt: z.iso.datetime({ offset: true }),
  persisted: z.boolean(),
})
export type AdminAiTestProviderOutput = z.infer<typeof adminAiTestProviderOutputSchema>

export const adminAiContract = {
  getConfig: oc
    .route({ method: 'GET', path: '/admin/ai/config', summary: 'AI 服务开关' })
    .output(adminAiConfigOutputSchema),
  updateConfig: oc
    .route({ method: 'PUT', path: '/admin/ai/config', summary: '更新 AI 服务开关' })
    .input(adminAiUpdateConfigInputSchema)
    .output(adminAiConfigOutputSchema),
  getProviderConfig: oc
    .route({ method: 'GET', path: '/admin/ai/provider', summary: '平台服务商配置' })
    .output(adminAiProviderConfigSchema),
  updateProviderConfig: oc
    .route({ method: 'PUT', path: '/admin/ai/provider', summary: '保存平台服务商配置' })
    .input(adminAiUpdateProviderInputSchema)
    .output(adminAiProviderConfigSchema),
  disableProviderConfig: oc
    .route({ method: 'POST', path: '/admin/ai/provider/disable', summary: '停用平台服务商配置' })
    .input(adminAiDisableProviderInputSchema)
    .output(adminAiProviderConfigSchema),
  testProviderConfig: oc
    .route({ method: 'POST', path: '/admin/ai/provider/test', summary: '测试平台服务商连接' })
    .input(adminAiTestProviderInputSchema)
    .output(adminAiTestProviderOutputSchema),
  listPrices: oc
    .route({ method: 'GET', path: '/admin/ai/prices', summary: 'AI 价格版本列表' })
    .output(adminAiListPricesOutputSchema),
  publishPrice: oc
    .route({ method: 'POST', path: '/admin/ai/prices', summary: '发布 AI 价格新版本' })
    .input(adminAiPublishPriceInputSchema)
    .output(adminAiPublishPriceOutputSchema),
  listRuns: oc
    .route({ method: 'GET', path: '/admin/ai/runs', summary: '运行与冻结对账列表' })
    .input(adminRunsInputSchema)
    .output(adminRunsOutputSchema),
}

export const adminCreditsContract = {
  overview: oc
    .route({ method: 'GET', path: '/admin/overview', summary: '运营概览聚合' })
    .output(adminOverviewOutputSchema),
  searchUsers: oc
    .route({ method: 'GET', path: '/admin/credits/users', summary: '积分用户检索' })
    .input(adminCreditsSearchInputSchema)
    .output(adminCreditsSearchOutputSchema),
  getUserDetail: oc
    .route({ method: 'GET', path: '/admin/credits/users/{userId}', summary: '积分用户批次明细' })
    .input(adminCreditsUserDetailInputSchema)
    .output(adminCreditsUserDetailOutputSchema),
  listLedger: oc
    .route({ method: 'GET', path: '/admin/credits/ledger', summary: '积分流水查询' })
    .input(adminCreditsLedgerInputSchema)
    .output(adminCreditsLedgerOutputSchema),
}

export const adminAuditContract = {
  listLogs: oc
    .route({ method: 'GET', path: '/admin/audit-logs', summary: '管理操作审计查询' })
    .input(adminAuditLogsInputSchema)
    .output(adminAuditLogsOutputSchema),
}

export const adminContract = {
  access: adminAccessContract,
  campaigns: adminCampaignsContract,
  ai: adminAiContract,
  credits: adminCreditsContract,
  audit: adminAuditContract,
}
