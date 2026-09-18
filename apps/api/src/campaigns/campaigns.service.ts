import { Inject, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'
import {
  campaignDraftConfigSchema,
  type CampaignDraftConfig,
} from '@studycommit/rpc-contracts/campaigns'
import { CreditsService } from '../credits/credits.service'
import { CreditsRepository, type DbTransaction } from '../credits/credits.repository'
import {
  CAMPAIGN_ERROR,
  type ClaimOutcome,
  type RegistrationEventPayload,
} from './campaigns.constants'
import {
  CampaignsRepository,
  type CampaignRow,
  type CampaignVersionRow,
} from './campaigns.repository'

const REGISTRATION_PROVIDER_BY_EVENT: Record<string, string> = {
  phone: 'phone',
  account: 'account',
  wechat_mini: 'wechat_mini',
  wechat_unionid: 'wechat_unionid',
}

export interface CampaignLifecycleActor {
  actorUserId: string
  reason: string
  requestId?: string | null
}

export type LifecycleTransition = 'publish' | 'pause' | 'resume' | 'end'

/**
 * 活动领域服务:草稿编辑、发布(不可变版本)、暂停/恢复/结束、手动领取与注册奖励消费。
 * 领取与注册消费复用同一积分发放服务与预算约束;版本绑定领取记录,版本变更不重置次数。
 */
@Injectable()
export class CampaignsService {
  constructor(
    @Inject(CampaignsRepository) private readonly repository: CampaignsRepository,
    @Inject(CreditsService) private readonly credits: CreditsService,
    @Inject(CreditsRepository) private readonly creditsRepository: CreditsRepository,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CampaignsService.name)
  }

  private parseConfig(raw: CampaignDraftConfig) {
    const result = campaignDraftConfigSchema.safeParse(raw)
    if (!result.success) {
      return {
        ok: false as const,
        code: CAMPAIGN_ERROR.draftInvalid.code,
        detail: result.error.issues.map((issue) => issue.message).join('; '),
      }
    }
    return { ok: true as const, config: result.data }
  }

  async createDraft(input: {
    code: string
    type: CampaignRow['type']
    totalBudgetCredits: number | null
    totalClaimLimit: number | null
    config: CampaignDraftConfig
    actor: CampaignLifecycleActor
  }) {
    const parsed = this.parseConfig(input.config)
    if (!parsed.ok) {
      return parsed
    }
    if (await this.repository.findCampaignByCode(input.code)) {
      return { ok: false as const, code: 'CAMPAIGN_CODE_TAKEN' as const }
    }
    const campaign = await this.repository.transaction(async (tx) => {
      const row = await this.repository.insertCampaignInTx(tx, {
        code: input.code,
        type: input.type,
        totalBudgetCredits: input.totalBudgetCredits,
        totalClaimLimit: input.totalClaimLimit,
        draftConfig: parsed.config,
      })
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'campaign.create_draft',
        targetType: 'campaign',
        targetId: row.id,
        afterSnapshot: { code: row.code, type: row.type },
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return row
    })
    return { ok: true as const, campaign }
  }

  async updateDraft(input: {
    campaignId: string
    expectedVersion: number
    config: CampaignDraftConfig
    budgets?: { totalBudgetCredits?: number | null; totalClaimLimit?: number | null }
    actor: CampaignLifecycleActor
  }) {
    const parsed = this.parseConfig(input.config)
    if (!parsed.ok) {
      return parsed
    }
    return this.repository.transaction(async (tx) => {
      const campaign = await this.repository.lockCampaignInTx(tx, input.campaignId)
      if (!campaign) {
        return { ok: false as const, code: CAMPAIGN_ERROR.notFound.code }
      }
      if (campaign.currentVersion !== input.expectedVersion) {
        return { ok: false as const, code: CAMPAIGN_ERROR.versionConflict.code }
      }
      await this.repository.updateDraftConfigInTx(
        tx,
        campaign.id,
        parsed.config,
        input.budgets ?? {},
      )
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'campaign.update_draft',
        targetType: 'campaign',
        targetId: campaign.id,
        beforeSnapshot: { draftConfig: campaign.draftConfig },
        afterSnapshot: { draftConfig: parsed.config },
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return { ok: true as const }
    })
  }

  /** 发布:产生不可变版本;expectedVersion 为当前版本号(草稿为 0)。 */
  async publish(input: {
    campaignId: string
    expectedVersion: number
    actor: CampaignLifecycleActor
  }) {
    return this.repository.transaction(async (tx) => {
      const campaign = await this.repository.lockCampaignInTx(tx, input.campaignId)
      if (!campaign) {
        return { ok: false as const, code: CAMPAIGN_ERROR.notFound.code }
      }
      if (campaign.status === 'ended') {
        return { ok: false as const, code: CAMPAIGN_ERROR.ended.code }
      }
      if (campaign.currentVersion !== input.expectedVersion) {
        return { ok: false as const, code: CAMPAIGN_ERROR.versionConflict.code }
      }
      const parsed = this.parseConfig(campaign.draftConfig)
      if (!parsed.ok) {
        return { ok: false as const, code: parsed.code }
      }
      const nextVersion = campaign.currentVersion + 1
      await this.repository.insertVersionInTx(tx, {
        campaignId: campaign.id,
        version: nextVersion,
        config: parsed.config,
      })
      await this.repository.updateStatusInTx(tx, campaign.id, 'published', {
        currentVersion: nextVersion,
      })
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'campaign.publish',
        targetType: 'campaign',
        targetId: campaign.id,
        beforeSnapshot: { currentVersion: campaign.currentVersion, status: campaign.status },
        afterSnapshot: { currentVersion: nextVersion, status: 'published' },
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return { ok: true as const, version: nextVersion }
    })
  }

  async transition(input: {
    campaignId: string
    expectedVersion: number
    action: Extract<LifecycleTransition, 'pause' | 'resume' | 'end'>
    actor: CampaignLifecycleActor
  }) {
    const allowedFrom: Record<string, CampaignRow['status'][]> = {
      pause: ['published'],
      resume: ['paused'],
      end: ['published', 'paused'],
    }
    const actionName = `campaign.${input.action}`
    return this.repository.transaction(async (tx) => {
      const campaign = await this.repository.lockCampaignInTx(tx, input.campaignId)
      if (!campaign) {
        return { ok: false as const, code: CAMPAIGN_ERROR.notFound.code }
      }
      if (campaign.currentVersion !== input.expectedVersion) {
        return { ok: false as const, code: CAMPAIGN_ERROR.versionConflict.code }
      }
      if (!allowedFrom[input.action].includes(campaign.status)) {
        return { ok: false as const, code: 'CAMPAIGN_INVALID_TRANSITION' as const }
      }
      const nextStatus: CampaignRow['status'] =
        input.action === 'pause' ? 'paused' : input.action === 'resume' ? 'published' : 'ended'
      await this.repository.updateStatusInTx(tx, campaign.id, nextStatus)
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: actionName,
        targetType: 'campaign',
        targetId: campaign.id,
        beforeSnapshot: { status: campaign.status },
        afterSnapshot: { status: nextStatus },
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return { ok: true as const, status: nextStatus }
    })
  }

  /**
   * 手动领取:单事务完成 锁活动 → 时间/版本/资格/预算 → 锁账户 → 唯一领取 → 发放 → 聚合。
   * 唯一冲突返回已有领取;同一幂等键不同参数返回冲突。
   */
  async claim(input: {
    userId: string
    campaignId: string
    expectedVersion: number
    idempotencyKey: string
  }): Promise<ClaimOutcome> {
    return this.repository.transaction(async (tx) => {
      const campaign = await this.repository.lockCampaignInTx(tx, input.campaignId)
      if (!campaign || campaign.status === 'draft' || campaign.currentVersion === 0) {
        return { ok: false, code: CAMPAIGN_ERROR.notFound.code }
      }
      if (campaign.type === 'registration_bonus') {
        return { ok: false, code: CAMPAIGN_ERROR.registrationNotClaimable.code }
      }
      if (campaign.currentVersion !== input.expectedVersion) {
        return { ok: false, code: CAMPAIGN_ERROR.versionConflict.code }
      }
      const version = await this.repository.findVersionInTx(
        tx,
        campaign.id,
        campaign.currentVersion,
      )
      if (!version) {
        return { ok: false, code: CAMPAIGN_ERROR.notFound.code }
      }
      const now = await this.repository.nowInTx(tx)
      if (campaign.status === 'paused') {
        return { ok: false, code: CAMPAIGN_ERROR.paused.code }
      }
      if (campaign.status === 'ended' || now.getTime() >= version.endsAt.getTime()) {
        return { ok: false, code: CAMPAIGN_ERROR.ended.code }
      }
      if (now.getTime() < version.startsAt.getTime()) {
        return { ok: false, code: CAMPAIGN_ERROR.notStarted.code }
      }
      const existingByKey = await this.repository.findClaimByIdempotencyKey(
        input.userId,
        input.idempotencyKey,
      )
      if (existingByKey && existingByKey.campaignId !== campaign.id) {
        return { ok: false, code: CAMPAIGN_ERROR.idempotencyConflict.code }
      }
      const user = await this.repository.findUserById(input.userId)
      if (!user || user.status !== 'active') {
        return { ok: false, code: CAMPAIGN_ERROR.ineligible.code }
      }
      if (
        campaign.totalBudgetCredits !== null &&
        campaign.totalGrantedCredits + version.grantCredits > campaign.totalBudgetCredits
      ) {
        return { ok: false, code: CAMPAIGN_ERROR.budgetExhausted.code }
      }
      if (
        campaign.totalClaimLimit !== null &&
        campaign.totalClaimCount + 1 > campaign.totalClaimLimit
      ) {
        return { ok: false, code: CAMPAIGN_ERROR.claimLimitReached.code }
      }
      const claim = await this.repository.insertClaimInTx(tx, {
        userId: input.userId,
        campaignId: campaign.id,
        version: campaign.currentVersion,
        idempotencyKey: input.idempotencyKey,
      })
      if (!claim) {
        // 并发重复领取:唯一约束生效,回查返回已有结果,不重复发放。
        const claims = await this.repository.listClaimsByUser(campaign.id, input.userId)
        const granted = claims.find((row) => row.status !== 'pending_compensation') ?? claims[0]
        if (!granted) {
          return { ok: false, code: CAMPAIGN_ERROR.alreadyClaimed.code }
        }
        return this.outcomeFromExistingClaim(tx, granted, version, input.userId)
      }
      const expiresAt = this.resolveExpiry(version, now)
      const grant = await this.credits.grantInTx(tx, {
        userId: input.userId,
        amount: version.grantCredits,
        source: 'campaign',
        campaignId: campaign.id,
        claimId: claim.id,
        expiresAt,
      })
      if (!grant.ok) {
        throw new Error(`积分发放失败: ${grant.code}`)
      }
      await this.repository.updateClaimStatusInTx(tx, claim.id, 'granted', grant.grant.id)
      await this.repository.incrementCampaignTotalsInTx(tx, campaign.id, version.grantCredits)
      const account = await this.creditsRepository.lockAccountInTx(tx, input.userId, false)
      return {
        ok: true,
        claimId: claim.id,
        status: 'granted',
        grantedCredits: version.grantCredits,
        expiresAt,
        version: campaign.currentVersion,
        balance: { available: account?.available ?? 0, reserved: account?.reserved ?? 0 },
      }
    })
  }

  private async outcomeFromExistingClaim(
    tx: DbTransaction,
    claim: { id: string; status: string; grantId: string | null; version: number },
    version: CampaignVersionRow,
    claimUserId: string,
  ): Promise<ClaimOutcome> {
    if (claim.status === 'pending_compensation') {
      return {
        ok: true,
        claimId: claim.id,
        status: 'pending_compensation',
        grantedCredits: null,
        expiresAt: null,
        version: claim.version,
        balance: { available: 0, reserved: 0 },
      }
    }
    const expiresAt = claim.grantId
      ? ((await this.creditsRepository.findGrantById(claim.grantId))?.expiresAt ?? null)
      : null
    const account = await this.creditsRepository.findAccountInTx(tx, claimUserId)
    return {
      ok: true,
      claimId: claim.id,
      status: 'granted',
      grantedCredits: version.grantCredits,
      expiresAt,
      version: claim.version,
      balance: { available: account?.available ?? 0, reserved: account?.reserved ?? 0 },
    }
  }

  private resolveExpiry(version: CampaignVersionRow, now: Date): Date | null {
    if (version.fixedExpiresAt) {
      return version.fixedExpiresAt
    }
    if (version.creditValidityDays !== null) {
      return new Date(now.getTime() + version.creditValidityDays * 24 * 60 * 60 * 1000)
    }
    return null
  }

  /**
   * 注册奖励消费(outbox handler):按事件发生时有效的规则版本判定,重复事件只发放一次。
   * 活动已暂停/结束或预算不足 → 记 pending_compensation 待管理员补偿,不静默放宽规则。
   */
  async consumeRegistrationEvent(payload: RegistrationEventPayload) {
    const verifiedAt = new Date(payload.verifiedAt)
    const provider = REGISTRATION_PROVIDER_BY_EVENT[payload.provider] ?? payload.provider
    const user = await this.repository.findUserById(payload.userId)
    if (!user) {
      // 用户行必须先于事件存在;缺失视为数据异常,交由 outbox 重试。
      throw new Error('注册奖励事件找不到用户')
    }
    return this.repository.transaction(async (tx) => {
      const candidates = await this.repository.lockRegistrationCampaignsInTx(tx)
      for (const campaign of candidates) {
        const version = await this.repository.findVersionInTx(
          tx,
          campaign.id,
          campaign.currentVersion,
        )
        if (!version) {
          this.logger.warn({ campaignId: campaign.id }, '注册奖励活动缺少已发布版本')
          continue
        }
        const config: CampaignDraftConfig = version.configSnapshot
        const withinWindow =
          verifiedAt.getTime() >= version.startsAt.getTime() &&
          verifiedAt.getTime() < version.endsAt.getTime()
        const eligibility = config.eligibility
        const providerAllowed =
          eligibility.providers === null ||
          (eligibility.providers as readonly string[]).includes(provider)
        const verifiedWithinRange =
          (eligibility.verifiedFrom === null ||
            verifiedAt.getTime() >= new Date(eligibility.verifiedFrom).getTime()) &&
          (eligibility.verifiedTo === null ||
            verifiedAt.getTime() <= new Date(eligibility.verifiedTo).getTime())
        const accountActive = !eligibility.requireActiveAccount || user.status === 'active'
        if (!withinWindow || !providerAllowed || !verifiedWithinRange || !accountActive) {
          continue
        }
        const existing = await this.repository.listUserRegistrationClaims(user.id)
        if (existing.length > 0) {
          // 注册奖励每人全局一次:已在任意注册活动领取/登记过的用户不再重复处理。
          continue
        }
        const canGrantNow =
          campaign.status === 'published' &&
          (campaign.totalBudgetCredits === null ||
            campaign.totalGrantedCredits + version.grantCredits <= campaign.totalBudgetCredits) &&
          (campaign.totalClaimLimit === null ||
            campaign.totalClaimCount + 1 <= campaign.totalClaimLimit)
        const claim = await this.repository.insertClaimInTx(tx, {
          userId: user.id,
          campaignId: campaign.id,
          version: campaign.currentVersion,
          status: canGrantNow ? 'granted' : 'pending_compensation',
        })
        if (!claim) {
          continue
        }
        if (canGrantNow) {
          const expiresAt = this.resolveExpiry(version, await this.repository.nowInTx(tx))
          const grant = await this.credits.grantInTx(tx, {
            userId: user.id,
            amount: version.grantCredits,
            source: 'campaign',
            campaignId: campaign.id,
            claimId: claim.id,
            expiresAt,
          })
          if (!grant.ok) {
            throw new Error(`注册奖励发放失败: ${grant.code}`)
          }
          await this.repository.updateClaimStatusInTx(tx, claim.id, 'granted', grant.grant.id)
          await this.repository.incrementCampaignTotalsInTx(tx, campaign.id, version.grantCredits)
          return { campaignId: campaign.id, granted: true as const, claimId: claim.id }
        }
        return {
          campaignId: campaign.id,
          granted: false as const,
          claimId: claim.id,
          reason: campaign.status !== 'published' ? 'campaign_paused' : 'budget_exhausted',
        }
      }
      return null
    })
  }

  /** 用户可见活动列表(published/paused);内部资格细节与预算余量不外泄。 */
  async listVisibleForUser(userId: string) {
    const [rows, claims] = await Promise.all([
      this.repository.listVisibleCampaigns(new Date()),
      this.repository.listClaimsByUserAll(userId),
    ])
    const claimsByCampaign = new Map<string, (typeof claims)[number]>()
    for (const claim of claims) {
      claimsByCampaign.set(claim.campaignId, claim)
    }
    const user = await this.repository.findUserById(userId)
    const serverNow = new Date().toISOString()
    return {
      serverNow,
      campaigns: rows.map((campaign) =>
        this.toSummaryDto(campaign, claimsByCampaign.get(campaign.id), user, serverNow),
      ),
    }
  }

  /** 活动详情:published/paused/ended 均可查;草稿对普通用户不存在。 */
  async getDetailForUser(userId: string, campaignId: string) {
    const campaign = await this.repository.findCampaignById(campaignId)
    if (!campaign || campaign.status === 'draft' || campaign.currentVersion === 0) {
      return null
    }
    const [claims, user] = await Promise.all([
      this.repository.listClaimsByUser(campaign.id, userId),
      this.repository.findUserById(userId),
    ])
    return this.toSummaryDto(campaign, claims[0], user, new Date().toISOString())
  }

  private toSummaryDto(
    campaign: CampaignRow,
    claim: { status: string } | undefined,
    user: { status: string } | null,
    serverNow: string,
  ) {
    const config = campaign.draftConfig
    const serverNowTime = new Date(serverNow).getTime()
    return {
      id: campaign.id,
      code: campaign.code,
      type: campaign.type,
      name: config.name,
      displayStatus: this.computeDisplayStatus(campaign, config, serverNowTime),
      claimState: this.computeClaimState(claim, user),
      version: campaign.currentVersion,
      startsAt: config.startsAt,
      endsAt: config.endsAt,
      grantCredits: config.grantCredits,
      creditValidityDays: config.creditValidityDays,
      fixedExpiresAt: config.fixedExpiresAt,
      platforms: config.platforms,
      copy: config.copy,
    }
  }

  private computeDisplayStatus(
    campaign: CampaignRow,
    config: CampaignDraftConfig,
    now: Date | number,
  ): 'not_started' | 'active' | 'paused' | 'ended' | 'exhausted' {
    const nowTime = now instanceof Date ? now.getTime() : now
    if (campaign.status === 'paused') {
return 'paused'
}
    if (nowTime >= new Date(config.endsAt).getTime()) {
return 'ended'
}
    if (nowTime < new Date(config.startsAt).getTime()) {
return 'not_started'
}
    if (
      (campaign.totalBudgetCredits !== null &&
        campaign.totalGrantedCredits >= campaign.totalBudgetCredits) ||
      (campaign.totalClaimLimit !== null && campaign.totalClaimCount >= campaign.totalClaimLimit)
    ) {
      return 'exhausted'
    }
    return 'active'
  }

  private computeClaimState(
    claim: { status: string } | undefined,
    user: { status: string } | null,
  ): 'claimable' | 'claimed' | 'pending_compensation' | 'ineligible' {
    if (claim?.status === 'granted') {
return 'claimed'
}
    if (claim?.status === 'pending_compensation') {
return 'pending_compensation'
}
    if (!user || user.status !== 'active') {
return 'ineligible'
}
    return 'claimable'
  }

  /**
   * 管理员补偿:把待补偿领取按其绑定的历史版本规则补发。
   * 这是唯一允许给"窗口已关闭的活动"补发的入口;预算不足时由 CHECK 与预算校验拒绝。
   */
  async compensateClaim(input: {
    campaignId: string
    claimId: string
    reason: string
    actor: CampaignLifecycleActor
  }) {
    return this.repository.transaction(async (tx) => {
      const campaign = await this.repository.lockCampaignInTx(tx, input.campaignId)
      if (!campaign) {
        return { ok: false as const, code: CAMPAIGN_ERROR.notFound.code }
      }
      const claim = await this.repository.lockClaimInTx(tx, input.claimId)
      if (!claim || claim.campaignId !== input.campaignId) {
        return { ok: false as const, code: CAMPAIGN_ERROR.notFound.code }
      }
      if (claim.status !== 'pending_compensation') {
        return { ok: false as const, code: 'CAMPAIGN_CLAIM_NOT_PENDING' as const }
      }
      const version = await this.repository.findVersionInTx(tx, campaign.id, claim.version)
      if (!version) {
        return { ok: false as const, code: CAMPAIGN_ERROR.notFound.code }
      }
      if (
        campaign.totalBudgetCredits !== null &&
        campaign.totalGrantedCredits + version.grantCredits > campaign.totalBudgetCredits
      ) {
        return { ok: false as const, code: CAMPAIGN_ERROR.budgetExhausted.code }
      }
      const user = await this.repository.findUserById(claim.userId)
      if (!user || user.status !== 'active') {
        return { ok: false as const, code: CAMPAIGN_ERROR.ineligible.code }
      }
      const expiresAt = this.resolveExpiry(version, await this.repository.nowInTx(tx))
      const grant = await this.credits.grantInTx(tx, {
        userId: claim.userId,
        amount: version.grantCredits,
        source: 'campaign',
        campaignId: campaign.id,
        claimId: claim.id,
        expiresAt,
      })
      if (!grant.ok) {
        throw new Error(`补偿发放失败: ${grant.code}`)
      }
      await this.repository.updateClaimStatusInTx(tx, claim.id, 'granted', grant.grant.id)
      await this.repository.incrementCampaignTotalsInTx(tx, campaign.id, version.grantCredits)
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'campaign.compensate_claim',
        targetType: 'campaign_claim',
        targetId: claim.id,
        beforeSnapshot: { status: 'pending_compensation' },
        afterSnapshot: { status: 'granted', grantedCredits: version.grantCredits },
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      const account = await this.creditsRepository.lockAccountInTx(tx, claim.userId, false)
      return {
        ok: true as const,
        claimId: claim.id,
        grantedCredits: version.grantCredits,
        expiresAt,
        balance: { available: account?.available ?? 0, reserved: account?.reserved ?? 0 },
      }
    })
  }
}
