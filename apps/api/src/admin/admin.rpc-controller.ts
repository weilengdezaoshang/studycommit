import { Controller, Inject, NotFoundException, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { adminContract } from '@studycommit/rpc-contracts/admin'
import type {
  CampaignDraftConfig,
  CampaignDisplayStatus,
} from '@studycommit/rpc-contracts/campaigns'
import type { AdminCampaignSummary } from '@studycommit/rpc-contracts/admin'
import { AdminGuard, type AdminRequest } from '../admin-access/admin-access.guard'
import { ADMIN_OPERATION_ROLE, type AdminRole } from '../admin-access/admin-access.constants'
import { AdminAccessService } from '../admin-access/admin-access.service'
import { handleOrpc } from '../common/orpc-error'
import { AiConfigService } from '../ai/ai-config.service'
import { AiProviderConfigService } from '../ai/ai-provider-config.service'
import { CampaignsService } from '../campaigns/campaigns.service'
import { campaignErrorOrThrow } from '../campaigns/campaigns.http'
import { AdminRepository } from './admin.repository'

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null)

/**
 * 管理端 RPC:每个操作在后端做角色校验(前端权限显示只是体验)。
 * 危险动作强制 reason + expectedVersion,并写审计。
 */
@Controller()
@UseGuards(AdminGuard)
export class AdminRpcController {
  constructor(
    @Inject(AdminAccessService) private readonly adminAccess: AdminAccessService,
    @Inject(AiConfigService) private readonly aiConfig: AiConfigService,
    @Inject(AiProviderConfigService) private readonly aiProviderConfig: AiProviderConfigService,
    @Inject(CampaignsService) private readonly campaigns: CampaignsService,
    @Inject(AdminRepository) private readonly repository: AdminRepository,
  ) {}

  @Implement(adminContract)
  adminRouter(@Req() request: AdminRequest) {
    const identity = request.adminIdentity
    const actor = (reason: string) => ({
      actorUserId: identity.userId,
      reason,
      requestId: request.id,
    })

    const campaignDto = (row: {
      id: string
      code: string
      type: 'registration_bonus' | 'limited_claim'
      status: 'draft' | 'published' | 'paused' | 'ended'
      currentVersion: number
      draftConfig: CampaignDraftConfig
      totalGrantedCredits: number
      totalClaimCount: number
      totalBudgetCredits: number | null
      totalClaimLimit: number | null
      createdAt: Date
      updatedAt: Date
    }): AdminCampaignSummary => {
      const config = row.draftConfig
      const now = Date.now()
      const budgetExhausted =
        (row.totalBudgetCredits !== null && row.totalGrantedCredits >= row.totalBudgetCredits) ||
        (row.totalClaimLimit !== null && row.totalClaimCount >= row.totalClaimLimit)
      const displayStatus: CampaignDisplayStatus =
        row.status === 'paused'
          ? 'paused'
          : now >= new Date(config.endsAt).getTime()
            ? 'ended'
            : now < new Date(config.startsAt).getTime()
              ? 'not_started'
              : budgetExhausted
                ? 'exhausted'
                : 'active'
      return {
        id: row.id,
        code: row.code,
        type: row.type,
        name: config.name,
        status: row.status,
        displayStatus,
        claimState: 'claimable' as const,
        version: row.currentVersion,
        startsAt: config.startsAt,
        endsAt: config.endsAt,
        grantCredits: config.grantCredits,
        creditValidityDays: config.creditValidityDays,
        fixedExpiresAt: config.fixedExpiresAt,
        platforms: config.platforms,
        copy: config.copy,
        currentVersion: row.currentVersion,
        totalGrantedCredits: row.totalGrantedCredits,
        totalClaimCount: row.totalClaimCount,
        totalBudgetCredits: row.totalBudgetCredits,
        totalClaimLimit: row.totalClaimLimit,
        displayTimezone: 'Asia/Shanghai',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    }

    return {
      access: {
        me: implement(adminContract.access.me).handler(() =>
          handleOrpc(async () => ({ userId: identity.userId, role: identity.role })),
        ),
        listRoles: implement(adminContract.access.listRoles).handler(() =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const rows = await this.adminAccess.listRoles()
            return {
              items: rows.map((row) => ({
                userId: row.userId,
                role: row.role as AdminRole,
                grantedBy: row.grantedBy,
                reason: row.reason,
                createdAt: row.createdAt.toISOString(),
              })),
            }
          }),
        ),
        grantRole: implement(adminContract.access.grantRole).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageRoles)
            this.adminAccess.assertValidReason(input.reason)
            return this.adminAccess.grantRole({
              actorUserId: identity.userId,
              targetUserId: input.userId,
              role: input.role,
              reason: input.reason.trim(),
              requestId: request.id,
            })
          }),
        ),
      },
      campaigns: {
        list: implement(adminContract.campaigns.list).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const page = await this.repository.listCampaigns({
              status: input.status ?? null,
              limit: input.limit,
              cursor: input.cursor ?? null,
            })
            return {
              items: page.items.map(campaignDto),
              nextCursor: page.nextCursor,
            }
          }),
        ),
        create: implement(adminContract.campaigns.create).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageCampaignDraft)
            this.adminAccess.assertValidReason(input.reason)
            const created = await this.campaigns.createDraft({
              code: input.code,
              type: input.type,
              totalBudgetCredits: input.totalBudgetCredits,
              totalClaimLimit: input.totalClaimLimit,
              config: input.config,
              actor: actor(input.reason.trim()),
            })
            if (!created.ok) {
              campaignErrorOrThrow(created.code)
            }
            return campaignDto(created.campaign)
          }),
        ),
        get: implement(adminContract.campaigns.get).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const detail = await this.repository.getCampaignDetail(input.id)
            if (!detail) {
              campaignErrorOrThrow('CAMPAIGN_NOT_FOUND')
            }
            return {
              ...campaignDto(detail.campaign),
              versions: detail.versions.map((version) => ({
                version: version.version,
                config: version.configSnapshot,
                eligibilityVersion: version.eligibilityVersion,
                createdAt: version.createdAt.toISOString(),
              })),
              draftConfig: detail.campaign.draftConfig,
            }
          }),
        ),
        updateDraft: implement(adminContract.campaigns.updateDraft).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageCampaignDraft)
            this.adminAccess.assertValidReason(input.reason)
            const updated = await this.campaigns.updateDraft({
              campaignId: input.id,
              expectedVersion: input.expectedVersion,
              config: input.config,
              actor: actor(input.reason.trim()),
            })
            if (!updated.ok) {
              campaignErrorOrThrow(updated.code)
            }
            const detail = await this.repository.getCampaignDetail(input.id)
            return campaignDto(detail!.campaign)
          }),
        ),
        publish: implement(adminContract.campaigns.publish).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.publishCampaign)
            this.adminAccess.assertValidReason(input.reason)
            const published = await this.campaigns.publish({
              campaignId: input.id,
              expectedVersion: input.expectedVersion,
              actor: actor(input.reason.trim()),
            })
            if (!published.ok) {
              campaignErrorOrThrow(published.code)
            }
            const detail = await this.repository.getCampaignDetail(input.id)
            return campaignDto(detail!.campaign)
          }),
        ),
        pause: implement(adminContract.campaigns.pause).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.publishCampaign)
            this.adminAccess.assertValidReason(input.reason)
            const paused = await this.campaigns.transition({
              campaignId: input.id,
              expectedVersion: input.expectedVersion,
              action: 'pause',
              actor: actor(input.reason.trim()),
            })
            if (!paused.ok) {
              campaignErrorOrThrow(paused.code)
            }
            const detail = await this.repository.getCampaignDetail(input.id)
            return campaignDto(detail!.campaign)
          }),
        ),
        resume: implement(adminContract.campaigns.resume).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.publishCampaign)
            this.adminAccess.assertValidReason(input.reason)
            const resumed = await this.campaigns.transition({
              campaignId: input.id,
              expectedVersion: input.expectedVersion,
              action: 'resume',
              actor: actor(input.reason.trim()),
            })
            if (!resumed.ok) {
              campaignErrorOrThrow(resumed.code)
            }
            const detail = await this.repository.getCampaignDetail(input.id)
            return campaignDto(detail!.campaign)
          }),
        ),
        end: implement(adminContract.campaigns.end).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.publishCampaign)
            this.adminAccess.assertValidReason(input.reason)
            const ended = await this.campaigns.transition({
              campaignId: input.id,
              expectedVersion: input.expectedVersion,
              action: 'end',
              actor: actor(input.reason.trim()),
            })
            if (!ended.ok) {
              campaignErrorOrThrow(ended.code)
            }
            const detail = await this.repository.getCampaignDetail(input.id)
            return campaignDto(detail!.campaign)
          }),
        ),
        listClaims: implement(adminContract.campaigns.listClaims).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const page = await this.repository.listClaims({
              campaignId: input.id,
              limit: input.limit,
              cursor: input.cursor ?? null,
            })
            return {
              items: page.items.map((claim) => ({
                claimId: claim.id,
                userId: claim.userId,
                version: claim.version,
                status: claim.status,
                grantedCredits: null,
                idempotencyKey: claim.idempotencyKey,
                createdAt: claim.createdAt.toISOString(),
              })),
              nextCursor: page.nextCursor,
            }
          }),
        ),
        compensate: implement(adminContract.campaigns.compensate).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.compensateClaim)
            this.adminAccess.assertValidReason(input.reason)
            const result = await this.campaigns.compensateClaim({
              campaignId: input.id,
              claimId: input.claimId,
              reason: input.reason.trim(),
              actor: actor(input.reason.trim()),
            })
            if (!result.ok) {
              campaignErrorOrThrow(result.code)
            }
            return {
              claimId: result.claimId,
              status: 'granted' as const,
              grantedCredits: result.grantedCredits,
            }
          }),
        ),
      },
      ai: {
        getConfig: implement(adminContract.ai.getConfig).handler(() =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            return this.aiConfig.getServiceConfig()
          }),
        ),
        updateConfig: implement(adminContract.ai.updateConfig).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.updateServiceSwitch)
            this.adminAccess.assertValidReason(input.reason)
            return this.aiConfig.updateServiceConfig({
              expectedVersion: input.expectedVersion,
              aiEnabled: input.aiEnabled,
              featureFlags: input.featureFlags,
              costProtectionEnabled: input.costProtectionEnabled,
              dailyCostBudget: input.dailyCostBudget,
              actor: actor(input.reason.trim()),
            })
          }),
        ),
        getProviderConfig: implement(adminContract.ai.getProviderConfig).handler(() =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageProviderConfig)
            return this.aiProviderConfig.getView()
          }),
        ),
        updateProviderConfig: implement(adminContract.ai.updateProviderConfig).handler(
          ({ input }) =>
            handleOrpc(async () => {
              this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageProviderConfig)
              this.adminAccess.assertValidReason(input.reason)
              return this.aiProviderConfig.update({
                expectedVersion: input.expectedVersion,
                protocol: input.protocol,
                baseUrl: input.baseUrl,
                model: input.model,
                apiKey: input.apiKey,
                operationId: input.operationId,
                actor: actor(input.reason.trim()),
              })
            }),
        ),
        disableProviderConfig: implement(adminContract.ai.disableProviderConfig).handler(
          ({ input }) =>
            handleOrpc(async () => {
              this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageProviderConfig)
              this.adminAccess.assertValidReason(input.reason)
              return this.aiProviderConfig.disable({
                expectedVersion: input.expectedVersion,
                operationId: input.operationId,
                actor: actor(input.reason.trim()),
              })
            }),
        ),
        testProviderConfig: implement(adminContract.ai.testProviderConfig).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageProviderConfig)
            return this.aiProviderConfig.test({
              protocol: input.protocol,
              baseUrl: input.baseUrl,
              model: input.model,
              apiKey: input.apiKey,
              actorUserId: identity.userId,
            })
          }),
        ),
        getProviderOperation: implement(adminContract.ai.getProviderOperation).handler(
          ({ input }) =>
            handleOrpc(async () => {
              this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.manageProviderConfig)
              const row = await this.aiProviderConfig.getOperation(input.operationId)
              if (!row) {
                throw new NotFoundException({
                  code: 'AI_PROVIDER_OPERATION_NOT_FOUND',
                  message: '未查询到该服务商配置操作',
                })
              }
              return row
            }),
        ),
        listPrices: implement(adminContract.ai.listPrices).handler(() =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const rows = await this.aiConfig.listPrices()
            return {
              items: rows.map((row) => ({
                id: row.id,
                action: row.action,
                version: row.version,
                priceCredits: row.priceCredits,
                configSnapshot: row.configSnapshot,
                isActive: row.isActive,
                publishedAt: iso(row.publishedAt),
                createdAt: row.createdAt.toISOString(),
              })),
            }
          }),
        ),
        publishPrice: implement(adminContract.ai.publishPrice).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.publishPrice)
            this.adminAccess.assertValidReason(input.reason)
            const row = await this.aiConfig.publishPrice({
              action: input.action,
              priceCredits: input.priceCredits,
              configSnapshot: input.configSnapshot,
              actor: actor(input.reason.trim()),
            })
            return {
              id: row.id,
              action: row.action,
              version: row.version,
              priceCredits: row.priceCredits,
              configSnapshot: row.configSnapshot,
              isActive: row.isActive,
              publishedAt: iso(row.publishedAt),
              createdAt: row.createdAt.toISOString(),
            }
          }),
        ),
        listRuns: implement(adminContract.ai.listRuns).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const page = await this.repository.listRuns({
              status: input.status ?? null,
              runId: input.runId ?? null,
              limit: input.limit,
              cursor: input.cursor ?? null,
            })
            return {
              items: page.items.map(({ run, reservation }) => ({
                runId: run.id,
                userId: run.userId,
                kind: run.kind,
                status: run.status,
                reservation: reservation
                  ? {
                      reservationId: reservation.id,
                      status: reservation.status,
                      amount: reservation.amount,
                      deadlineAt: reservation.deadlineAt.toISOString(),
                    }
                  : null,
                error: run.error,
                createdAt: run.createdAt.toISOString(),
              })),
              nextCursor: page.nextCursor,
            }
          }),
        ),
        getRun: implement(adminContract.ai.getRun).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const row = await this.repository.findRunById(input.runId)
            if (!row) {
              throw new NotFoundException({
                code: 'AI_RUN_NOT_FOUND',
                message: '运行记录不存在',
              })
            }
            const { run, reservation } = row
            return {
              runId: run.id,
              userId: run.userId,
              kind: run.kind,
              status: run.status,
              reservation: reservation
                ? {
                    reservationId: reservation.id,
                    status: reservation.status,
                    amount: reservation.amount,
                    deadlineAt: reservation.deadlineAt.toISOString(),
                  }
                : null,
              error: run.error,
              createdAt: run.createdAt.toISOString(),
            }
          }),
        ),
      },
      credits: {
        overview: implement(adminContract.credits.overview).handler(() =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            return this.repository.overview()
          }),
        ),
        searchUsers: implement(adminContract.credits.searchUsers).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const rows = await this.repository.searchCreditUsers({
              query: input.query,
              limit: input.limit,
            })
            return {
              items: rows.map((row) => ({
                userId: row.userId,
                nickname: row.nickname,
                available: row.available ?? 0,
                reserved: row.reserved ?? 0,
                lifetimeGranted: row.lifetimeGranted ?? 0,
              })),
            }
          }),
        ),
        getUserDetail: implement(adminContract.credits.getUserDetail).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const detail = await this.repository.getCreditUserDetail(input.userId)
            if (!detail) {
              campaignErrorOrThrow('CAMPAIGN_NOT_FOUND')
            }
            return {
              user: {
                userId: detail.user.userId,
                nickname: detail.user.nickname,
                available: detail.user.available ?? 0,
                reserved: detail.user.reserved ?? 0,
                lifetimeGranted: detail.user.lifetimeGranted ?? 0,
              },
              grants: detail.grants.map((grant) => ({
                grantId: grant.id,
                source: grant.source,
                campaignId: grant.campaignId,
                originalAmount: grant.originalAmount,
                remainingAvailable: grant.remainingAvailable,
                frozenAmount: grant.frozenAmount,
                status: grant.status,
                expiresAt: grant.expiresAt?.toISOString() ?? null,
                createdAt: grant.createdAt.toISOString(),
              })),
            }
          }),
        ),
        listLedger: implement(adminContract.credits.listLedger).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const page = await this.repository.listLedger({
              userId: input.userId ?? null,
              campaignId: input.campaignId ?? null,
              kind: input.kind ?? null,
              limit: input.limit,
              cursor: input.cursor ?? null,
            })
            return {
              items: page.items.map((row) => ({
                eventId: row.eventId,
                userId: row.userId,
                kind: row.kind,
                deltaAvailable: row.deltaAvailable,
                deltaReserved: row.deltaReserved,
                grantId: row.grantId,
                reservationId: row.reservationId,
                runId: row.runId,
                campaignId: row.campaignId,
                createdAt: row.createdAt.toISOString(),
              })),
              nextCursor: page.nextCursor,
            }
          }),
        ),
      },
      audit: {
        listLogs: implement(adminContract.audit.listLogs).handler(({ input }) =>
          handleOrpc(async () => {
            this.adminAccess.requireRole(identity, ADMIN_OPERATION_ROLE.readAll)
            const page = await this.repository.listAuditLogs({
              actorUserId: input.actorUserId ?? null,
              targetType: input.targetType ?? null,
              targetId: input.targetId ?? null,
              limit: input.limit,
              cursor: input.cursor ?? null,
            })
            return {
              items: page.items.map((row) => ({
                id: row.id,
                actorUserId: row.actorUserId,
                action: row.action,
                targetType: row.targetType,
                targetId: row.targetId,
                reason: row.reason,
                requestId: row.requestId,
                createdAt: row.createdAt.toISOString(),
              })),
              nextCursor: page.nextCursor,
            }
          }),
        ),
      },
    }
  }
}
