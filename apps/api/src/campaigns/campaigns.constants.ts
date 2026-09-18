import type { CampaignDraftConfig } from '@studycommit/rpc-contracts/campaigns'

/**
 * 锁顺序约定(与 credits 一致并向前扩展):
 * ai_service_config → ai_cost_budgets → campaigns(行锁) → credit_accounts → credit_grants。
 * 领取与暂停/发布竞争同一活动行锁:先提交者生效。
 */
export const CAMPAIGN_ERROR = {
  notFound: { code: 'CAMPAIGN_NOT_FOUND', message: '活动不存在或未发布' },
  versionConflict: { code: 'CAMPAIGN_VERSION_CONFLICT', message: '活动版本已变化,请刷新后重试' },
  notStarted: { code: 'CAMPAIGN_NOT_STARTED', message: '活动尚未开始' },
  paused: { code: 'CAMPAIGN_PAUSED', message: '活动已暂停,暂不接受领取' },
  ended: { code: 'CAMPAIGN_ENDED', message: '活动已结束' },
  budgetExhausted: { code: 'CAMPAIGN_BUDGET_EXHAUSTED', message: '活动额度已用完' },
  claimLimitReached: { code: 'CAMPAIGN_CLAIM_LIMIT_REACHED', message: '已达到领取上限' },
  alreadyClaimed: { code: 'CAMPAIGN_ALREADY_CLAIMED', message: '已经领取过该活动' },
  ineligible: { code: 'CAMPAIGN_INELIGIBLE', message: '不符合领取条件' },
  idempotencyConflict: { code: 'IDEMPOTENCY_KEY_REUSED', message: '幂等键已用于不同请求' },
  registrationNotClaimable: {
    code: 'CAMPAIGN_NOT_CLAIMABLE',
    message: '注册奖励活动不支持手动领取',
  },
  draftInvalid: { code: 'CAMPAIGN_DRAFT_INVALID', message: '活动草稿配置不合法' },
  codeTaken: { code: 'CAMPAIGN_CODE_TAKEN', message: '活动 code 已存在' },
  invalidTransition: { code: 'CAMPAIGN_INVALID_TRANSITION', message: '活动状态不允许该操作' },
  claimNotPending: { code: 'CAMPAIGN_CLAIM_NOT_PENDING', message: '该领取记录不在待补偿状态' },
} as const

export type CampaignErrorCode = (typeof CAMPAIGN_ERROR)[keyof typeof CAMPAIGN_ERROR]['code']

export const REGISTRATION_BONUS_EVENT_PAYLOAD = {
  userId: 'userId',
  provider: 'provider',
  verifiedAt: 'verifiedAt',
} as const

export interface RegistrationEventPayload {
  userId: string
  provider: string
  verifiedAt: string
}

/** 领取结果(服务层);RPC 层负责映射为契约输出与 HTTP 语义。 */
export type ClaimOutcome =
  | {
      ok: true
      claimId: string
      status: 'granted' | 'pending_compensation'
      grantedCredits: number | null
      expiresAt: Date | null
      version: number
      balance: { available: number; reserved: number }
    }
  | { ok: false; code: CampaignErrorCode }

export interface CampaignWithDraft {
  id: string
  code: string
  type: string
  status: 'draft' | 'published' | 'paused' | 'ended'
  currentVersion: number
  draftConfig: CampaignDraftConfig
  totalGrantedCredits: number
  totalClaimCount: number
  totalBudgetCredits: number | null
  totalClaimLimit: number | null
  createdAt: Date
  updatedAt: Date
}
