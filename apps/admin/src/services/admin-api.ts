import { AdminClient, toQuery } from './api-client'
import { clearAdminQueries } from './query-client'
import { clearSession, getAccessToken } from './session'
import type {
  AccessMe,
  AccountLoginOutput,
  AiPrice,
  AiProviderConfig,
  AiProviderOperation,
  AiProviderTestResult,
  AiServiceConfig,
  AuditLog,
  CampaignClaim,
  CampaignDetail,
  CampaignDraftConfig,
  CampaignStatus,
  CampaignSummary,
  CreditGrant,
  CreditUser,
  CursorPage,
  LedgerEntry,
  LedgerKind,
  Overview,
  RoleRow,
  RunRow,
  RunStatus,
} from './types'
import type { AdminRole } from '@/auth/capabilities'

let redirectToLogin: (() => void) | null = null

export function setLoginRedirect(handler: () => void) {
  redirectToLogin = handler
}

function onUnauthorized() {
  clearSession()
  clearAdminQueries()
  redirectToLogin?.()
}

export const client = new AdminClient({
  baseUrl: '',
  getToken: getAccessToken,
  onUnauthorized,
})

const unauthenticatedClient = new AdminClient({
  baseUrl: '',
  getToken: () => null,
})

export const adminApi = {
  login(body: { account: string; password: string; deviceType: 'desktop' }) {
    return unauthenticatedClient.post<AccountLoginOutput>('/api/auth/account/login', body)
  },
  me() {
    return client.get<AccessMe>('/api/admin/access/me')
  },
  overview() {
    return client.get<Overview>('/api/admin/overview')
  },
  listCampaigns(params: {
    status?: CampaignStatus | null
    limit?: number
    cursor?: string | null
  }) {
    return client.get<CursorPage<CampaignSummary>>(
      `/api/admin/campaigns${toQuery({
        status: params.status ?? undefined,
        cursor: params.cursor ?? undefined,
      })}`,
    )
  },
  getCampaign(id: string) {
    return client.get<CampaignDetail>(`/api/admin/campaigns/${id}`)
  },
  createCampaign(body: {
    code: string
    type: CampaignSummary['type']
    totalBudgetCredits: number | null
    totalClaimLimit: number | null
    displayTimezone: string
    config: CampaignDraftConfig
    reason: string
  }) {
    return client.post<CampaignSummary>('/api/admin/campaigns', body)
  },
  updateDraft(body: {
    id: string
    expectedVersion: number
    config: CampaignDraftConfig
    reason: string
  }) {
    return client.put<CampaignSummary>(`/api/admin/campaigns/${body.id}/draft`, body)
  },
  transitionCampaign(
    action: 'publish' | 'pause' | 'resume' | 'end',
    body: { id: string; expectedVersion: number; reason: string },
  ) {
    return client.post<CampaignSummary>(`/api/admin/campaigns/${body.id}/${action}`, body)
  },
  listClaims(params: { id: string; limit?: number; cursor?: string | null }) {
    return client.get<CursorPage<CampaignClaim>>(
      `/api/admin/campaigns/${params.id}/claims${toQuery({
        cursor: params.cursor ?? undefined,
      })}`,
    )
  },
  compensateClaim(body: { id: string; claimId: string; reason: string }) {
    return client.post<{
      claimId: string
      status: CampaignClaim['status']
      grantedCredits: number | null
    }>(`/api/admin/campaigns/${body.id}/compensate`, body)
  },
  listRuns(params: {
    status?: RunStatus | null
    runId?: string | null
    limit?: number
    cursor?: string | null
  }) {
    return client.get<CursorPage<RunRow>>(
      `/api/admin/ai/runs${toQuery({
        status: params.status ?? undefined,
        runId: params.runId ?? undefined,
        cursor: params.cursor ?? undefined,
      })}`,
    )
  },
  getRun(runId: string, init?: { signal?: AbortSignal }) {
    return client.get<RunRow>(`/api/admin/ai/runs/${runId}`, init)
  },
  searchCreditUsers(params: { query: string; limit?: number }) {
    return client.get<{ items: CreditUser[] }>(
      `/api/admin/credits/users${toQuery({ query: params.query })}`,
    )
  },
  getCreditUser(userId: string) {
    return client.get<{ user: CreditUser; grants: CreditGrant[] }>(
      `/api/admin/credits/users/${userId}`,
    )
  },
  listLedger(params: {
    userId?: string | null
    campaignId?: string | null
    kind?: LedgerKind | null
    limit?: number
    cursor?: string | null
  }) {
    return client.get<CursorPage<LedgerEntry>>(
      `/api/admin/credits/ledger${toQuery({
        userId: params.userId ?? undefined,
        campaignId: params.campaignId ?? undefined,
        kind: params.kind ?? undefined,
        cursor: params.cursor ?? undefined,
      })}`,
    )
  },
  getAiConfig() {
    return client.get<AiServiceConfig>('/api/admin/ai/config')
  },
  updateAiConfig(body: {
    expectedVersion: number
    aiEnabled?: boolean
    featureFlags?: Record<string, boolean>
    costProtectionEnabled?: boolean
    dailyCostBudget?: string | null
    reason: string
  }) {
    return client.put<AiServiceConfig>('/api/admin/ai/config', body)
  },
  getAiProvider() {
    return client.get<AiProviderConfig>('/api/admin/ai/provider')
  },
  updateAiProvider(body: {
    expectedVersion: number
    protocol: AiProviderConfig['protocol']
    baseUrl?: string
    model: string
    apiKey?: string
    operationId: string
    reason: string
  }) {
    return client.put<AiProviderConfig>('/api/admin/ai/provider', body)
  },
  disableAiProvider(body: { expectedVersion: number; operationId: string; reason: string }) {
    return client.post<AiProviderConfig>('/api/admin/ai/provider/disable', body)
  },
  testAiProvider(
    body: {
      protocol: NonNullable<AiProviderConfig['protocol']>
      baseUrl?: string
      model: string
      apiKey?: string
    },
    init?: { signal?: AbortSignal },
  ) {
    return client.post<AiProviderTestResult>('/api/admin/ai/provider/test', body, init)
  },
  getAiProviderOperation(operationId: string) {
    return client.get<AiProviderOperation>(`/api/admin/ai/provider/operations/${operationId}`)
  },
  listPrices() {
    return client.get<{ items: AiPrice[] }>('/api/admin/ai/prices')
  },
  publishPrice(body: {
    action: 'paper_explain'
    priceCredits: number
    configSnapshot: AiPrice['configSnapshot']
    reason: string
  }) {
    return client.post<AiPrice>('/api/admin/ai/prices', body)
  },
  listAuditLogs(params: {
    actorUserId?: string | null
    targetType?: string | null
    targetId?: string | null
    limit?: number
    cursor?: string | null
  }) {
    return client.get<CursorPage<AuditLog>>(
      `/api/admin/audit-logs${toQuery({
        actorUserId: params.actorUserId ?? undefined,
        targetType: params.targetType ?? undefined,
        targetId: params.targetId ?? undefined,
        cursor: params.cursor ?? undefined,
      })}`,
    )
  },
  listRoles() {
    return client.get<{ items: RoleRow[] }>('/api/admin/roles')
  },
  grantRole(body: { userId: string; role: AdminRole; reason: string }) {
    return client.post<{ userId: string; role: AdminRole }>('/api/admin/roles', body)
  },
}
