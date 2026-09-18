import { oc } from '@orpc/contract'
import { z } from 'zod'

/**
 * 运营活动契约(用户侧可见活动与领取)。
 * 面向用户的输出只含展示信息与个人领取状态;
 * 内部人群条件、预算余量等秘密配置仅出现在 admin 契约中。
 */

/** 活动展示平台;仅决定展示,不是安全资格证明。 */
export const campaignPlatformSchema = z.enum(['desktop', 'mobile', 'miniprogram'])
export type CampaignPlatform = z.infer<typeof campaignPlatformSchema>

export const campaignProviderSchema = z.enum(['phone', 'account', 'wechat_mini', 'wechat_unionid'])
export type CampaignProvider = z.infer<typeof campaignProviderSchema>

/** 展示文案:领取入口与成功反馈。 */
export const campaignCopySchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  successMessage: z.string().trim().min(1).max(200),
})
export type CampaignCopy = z.infer<typeof campaignCopySchema>

export const campaignTypeSchema = z.enum(['registration_bonus', 'limited_claim'])
export type CampaignType = z.infer<typeof campaignTypeSchema>

/** 首版资格:仅允许明确字段,不接收任意表达式。 */
export const campaignEligibilitySchema = z.object({
  /** 注册(首次验证成功)时间窗;null 表示不限制。 */
  verifiedFrom: z.iso.datetime({ offset: true }).nullable(),
  verifiedTo: z.iso.datetime({ offset: true }).nullable(),
  /** 允许的注册方式;null 表示不限制。 */
  providers: z.array(campaignProviderSchema).min(1).nullable(),
  /** v1 恒为 true:账号必须处于 active 状态;显式写出防误解。 */
  requireActiveAccount: z.literal(true),
})
export type CampaignEligibility = z.infer<typeof campaignEligibilitySchema>

/**
 * 活动规则(草稿与不可变版本共用结构)。
 * creditValidityDays 与 fixedExpiresAt 必须二选一;
 * 每次发布生成不可变快照,资格版本号即发布版本号,不单设 eligibilityVersion。
 */
export const campaignDraftConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    grantCredits: z.number().int().min(1).max(1_000_000_000),
    creditValidityDays: z.number().int().min(1).max(3650).nullable(),
    fixedExpiresAt: z.iso.datetime({ offset: true }).nullable(),
    perUserLimit: z.number().int().min(1).max(100),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    platforms: z.array(campaignPlatformSchema).min(1),
    eligibility: campaignEligibilitySchema,
    copy: campaignCopySchema,
  })
  .refine((config) => (config.creditValidityDays === null) !== (config.fixedExpiresAt === null), {
    message: 'creditValidityDays 与 fixedExpiresAt 必须二选一',
  })
  .refine((config) => config.startsAt < config.endsAt, {
    message: 'startsAt 必须早于 endsAt',
  })
export type CampaignDraftConfig = z.infer<typeof campaignDraftConfigSchema>

/** 按服务端当前时间计算的展示状态;人工状态(published/paused)之外叠加时间与额度。 */
export const campaignDisplayStatusSchema = z.enum([
  'not_started',
  'active',
  'paused',
  'ended',
  'exhausted',
])
export type CampaignDisplayStatus = z.infer<typeof campaignDisplayStatusSchema>

/** 当前用户对活动的领取状态。 */
export const campaignClaimStateSchema = z.enum([
  'claimable',
  'claimed',
  'pending_compensation',
  'ineligible',
])
export type CampaignClaimState = z.infer<typeof campaignClaimStateSchema>

/** 领取记录状态:granted 已发放;pending_compensation 因活动暂停/结束暂缓发放。 */
export const campaignClaimStatusSchema = z.enum(['granted', 'pending_compensation'])
export type CampaignClaimStatus = z.infer<typeof campaignClaimStatusSchema>

export const campaignSummarySchema = z.object({
  id: z.uuid(),
  code: z.string(),
  type: campaignTypeSchema,
  name: z.string(),
  displayStatus: campaignDisplayStatusSchema,
  claimState: campaignClaimStateSchema,
  version: z.number().int().min(1),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  grantCredits: z.number().int().min(1),
  creditValidityDays: z.number().int().min(1).nullable(),
  fixedExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  platforms: z.array(campaignPlatformSchema),
  copy: campaignCopySchema,
})
export type CampaignSummary = z.infer<typeof campaignSummarySchema>

export const campaignsListOutputSchema = z.object({
  serverNow: z.iso.datetime({ offset: true }),
  campaigns: z.array(campaignSummarySchema),
})
export type CampaignsListOutput = z.infer<typeof campaignsListOutputSchema>

export const campaignsDetailInputSchema = z.object({ id: z.uuid() })

export const campaignsDetailOutputSchema = campaignSummarySchema
export type CampaignsDetailOutput = z.infer<typeof campaignsDetailOutputSchema>

export const campaignsClaimInputSchema = z.object({
  id: z.uuid(),
  /** 客户端看到的版本;不一致时拒绝,提示刷新后再试。 */
  expectedVersion: z.number().int().min(1),
})

export const campaignClaimResultSchema = z.object({
  claimId: z.uuid(),
  status: campaignClaimStatusSchema,
  /** granted 时必有;待补偿时无发放。 */
  grantedCredits: z.number().int().min(1).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  version: z.number().int().min(1),
})
export type CampaignClaimResult = z.infer<typeof campaignClaimResultSchema>

export const campaignsClaimOutputSchema = z.object({
  claim: campaignClaimResultSchema,
  /** 领取后的最新权威余额。 */
  balance: z.object({
    available: z.number().int().min(0),
    reserved: z.number().int().min(0),
  }),
})
export type CampaignsClaimOutput = z.infer<typeof campaignsClaimOutputSchema>

export const campaignsContract = {
  list: oc
    .route({ method: 'GET', path: '/campaigns', summary: '当前用户可见活动列表' })
    .output(campaignsListOutputSchema),
  detail: oc
    .route({ method: 'GET', path: '/campaigns/{id}', summary: '活动详情' })
    .input(campaignsDetailInputSchema)
    .output(campaignsDetailOutputSchema),
  claim: oc
    .route({ method: 'POST', path: '/campaigns/{id}/claim', summary: '领取活动积分' })
    .input(campaignsClaimInputSchema)
    .output(campaignsClaimOutputSchema),
}
