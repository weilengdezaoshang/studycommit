import type { AdminRole } from '@/auth/capabilities'

export type CampaignType = 'registration_bonus' | 'limited_claim'
export type CampaignStatus = 'draft' | 'published' | 'paused' | 'ended'
export type CampaignDisplayStatus = 'not_started' | 'active' | 'paused' | 'ended' | 'exhausted'
export type CampaignPlatform = 'desktop' | 'mobile' | 'miniprogram'
export type CampaignClaimStatus = 'granted' | 'pending_compensation'
export type RunStatus = 'pending' | 'completed' | 'failed'
export type ReservationStatus = 'active' | 'settled' | 'released' | 'expired'
export type LedgerKind = 'grant' | 'reserve' | 'settle' | 'release' | 'expire'
export type GrantStatus = 'active' | 'expired'

export interface CampaignCopy {
  title: string
  description: string
  successMessage: string
}

export interface CampaignEligibility {
  verifiedFrom: string | null
  verifiedTo: string | null
  providers: Array<'phone' | 'account' | 'wechat_mini' | 'wechat_unionid'> | null
  requireActiveAccount: true
}

export interface CampaignDraftConfig {
  name: string
  grantCredits: number
  creditValidityDays: number | null
  fixedExpiresAt: string | null
  perUserLimit: number
  startsAt: string
  endsAt: string
  platforms: CampaignPlatform[]
  eligibility: CampaignEligibility
  copy: CampaignCopy
}

export interface CampaignSummary {
  id: string
  code: string
  type: CampaignType
  name: string
  status: CampaignStatus
  displayStatus: CampaignDisplayStatus
  version: number
  currentVersion: number
  startsAt: string
  endsAt: string
  grantCredits: number
  creditValidityDays: number | null
  fixedExpiresAt: string | null
  platforms: CampaignPlatform[]
  copy: CampaignCopy
  totalGrantedCredits: number
  totalClaimCount: number
  totalBudgetCredits: number | null
  totalClaimLimit: number | null
  displayTimezone: string
  createdAt: string
  updatedAt: string
}

export interface CampaignVersion {
  version: number
  config: CampaignDraftConfig
  eligibilityVersion: number
  createdAt: string
}

export interface CampaignDetail extends CampaignSummary {
  versions: CampaignVersion[]
  draftConfig: CampaignDraftConfig | null
}

export interface CampaignClaim {
  claimId: string
  userId: string
  version: number
  status: CampaignClaimStatus
  grantedCredits: number | null
  idempotencyKey: string | null
  createdAt: string
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface Overview {
  serverNow: string
  campaigns: {
    publishedCount: number
    totalGrantedCredits: number
    totalClaimCount: number
  }
  ai: {
    enabled: boolean
    activePriceVersion: number | null
    runs: {
      pending: number
      completedToday: number
      failedToday: number
      longFrozen: number
    }
    cost: {
      reservedToday: string
      confirmedToday: string
      dailyBudget: string | null
    }
  }
  credits: {
    reservedTotal: number
    pendingCompensationCount: number
  }
}

export interface AiServiceConfig {
  aiEnabled: boolean
  featureFlags: Record<string, boolean>
  costProtectionEnabled: boolean
  dailyCostBudget: string | null
  version: number
  updatedAt: string
}

export type AiProviderProtocol = 'openai' | 'anthropic' | 'gemini'
export type AiProviderDisplayStatus =
  'unconfigured' | 'configured_unverified' | 'connected' | 'connection_failed' | 'disabled'

export interface AiProviderConfig {
  displayStatus: AiProviderDisplayStatus
  protocol: AiProviderProtocol | null
  baseUrl: string | null
  model: string | null
  hasApiKey: boolean
  apiKeyHint: string | null
  lastTestStatus: 'success' | 'failed' | 'unverified' | null
  lastTestedAt: string | null
  billedModel: string | null
  envFallbackActive: boolean
  version: number
  updatedAt: string | null
}

export interface AiProviderTestResult {
  ok: boolean
  code: 'connected' | 'auth_failed' | 'timeout' | 'unsafe_url' | 'rate_limited' | 'failed'
  message: string
  testedAt: string
  persisted: boolean
}

export interface AiPrice {
  id: string
  action: string
  version: number
  priceCredits: number
  configSnapshot: {
    model: string
    maxInputTokens: number
    maxOutputTokens: number
    estimatedCostPerRun: string
    currency: string
  }
  isActive: boolean
  publishedAt: string | null
  createdAt: string
}

export interface RunRow {
  runId: string
  userId: string
  kind: 'companion_followup' | 'paper_explain'
  status: RunStatus
  reservation: {
    reservationId: string
    status: ReservationStatus
    amount: number
    deadlineAt: string
  } | null
  error: string | null
  createdAt: string
}

export interface CreditUser {
  userId: string
  nickname: string | null
  available: number
  reserved: number
  lifetimeGranted: number
}

export interface CreditGrant {
  grantId: string
  source: 'campaign' | 'admin_grant'
  campaignId: string | null
  originalAmount: number
  remainingAvailable: number
  frozenAmount: number
  status: GrantStatus
  expiresAt: string | null
  createdAt: string
}

export interface LedgerEntry {
  eventId: string
  userId: string
  kind: LedgerKind
  deltaAvailable: number
  deltaReserved: number
  grantId: string | null
  reservationId: string | null
  runId: string | null
  campaignId: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  actorUserId: string
  action: string
  targetType: string
  targetId: string
  reason: string
  requestId: string | null
  createdAt: string
}

export interface RoleRow {
  userId: string
  role: AdminRole
  grantedBy: string | null
  reason: string | null
  createdAt: string
}

export interface AccountLoginInput {
  account: string
  password: string
  deviceType: 'desktop' | 'mobile' | 'miniprogram'
}

export interface AccountLoginOutput {
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
    status: 'active' | 'disabled' | 'merged'
  }
  tokens: {
    accessToken: string
    refreshToken: string
    expiresAt: string
  }
}

export interface AccessMe {
  userId: string
  role: AdminRole
}
