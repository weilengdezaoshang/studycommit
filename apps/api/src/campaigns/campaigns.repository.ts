import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import {
  adminAuditLogs,
  campaignClaims,
  campaignVersions,
  campaigns,
  users,
} from '../database/schema'
import type { CampaignDraftConfig } from '@studycommit/rpc-contracts/campaigns'

export type DbTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]
export type CampaignRow = typeof campaigns.$inferSelect
export type CampaignVersionRow = typeof campaignVersions.$inferSelect
export type CampaignClaimRow = typeof campaignClaims.$inferSelect

@Injectable()
export class CampaignsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 事务入口:服务层统一经由此方法开启事务。 */
  transaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.database.db.transaction(work)
  }

  async nowInTx(tx: DbTransaction): Promise<Date> {
    const result = await tx.execute<{ now: string }>(sql`select now()::text as now`)
    return new Date(result.rows[0].now)
  }

  async insertCampaignInTx(
    tx: DbTransaction,
    input: {
      code: string
      type: CampaignRow['type']
      totalBudgetCredits: number | null
      totalClaimLimit: number | null
      draftConfig: CampaignDraftConfig
    },
  ): Promise<CampaignRow> {
    const [row] = await tx.insert(campaigns).values(input).returning()
    return row
  }

  async findCampaignById(id: string) {
    const [row] = await this.database.db.select().from(campaigns).where(eq(campaigns.id, id))
    return row ?? null
  }

  async findCampaignByCode(code: string) {
    const [row] = await this.database.db.select().from(campaigns).where(eq(campaigns.code, code))
    return row ?? null
  }

  async lockCampaignInTx(tx: DbTransaction, id: string): Promise<CampaignRow | null> {
    const [row] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for('update')
    return row ?? null
  }

  async updateDraftConfigInTx(
    tx: DbTransaction,
    id: string,
    draftConfig: CampaignDraftConfig,
    budgets: { totalBudgetCredits?: number | null; totalClaimLimit?: number | null },
  ) {
    await tx
      .update(campaigns)
      .set({
        draftConfig,
        ...(budgets.totalBudgetCredits !== undefined
          ? { totalBudgetCredits: budgets.totalBudgetCredits }
          : {}),
        ...(budgets.totalClaimLimit !== undefined
          ? { totalClaimLimit: budgets.totalClaimLimit }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))
  }

  async updateStatusInTx(
    tx: DbTransaction,
    id: string,
    status: CampaignRow['status'],
    patch: { currentVersion?: number } = {},
  ) {
    await tx
      .update(campaigns)
      .set({ status, ...patch, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
  }

  async insertVersionInTx(
    tx: DbTransaction,
    input: {
      campaignId: string
      version: number
      config: CampaignDraftConfig
    },
  ): Promise<CampaignVersionRow> {
    const [row] = await tx
      .insert(campaignVersions)
      .values({
        campaignId: input.campaignId,
        version: input.version,
        startsAt: new Date(input.config.startsAt),
        endsAt: new Date(input.config.endsAt),
        grantCredits: input.config.grantCredits,
        creditValidityDays: input.config.creditValidityDays,
        fixedExpiresAt: input.config.fixedExpiresAt ? new Date(input.config.fixedExpiresAt) : null,
        perUserLimit: input.config.perUserLimit,
        eligibilityVersion: input.version,
        configSnapshot: input.config,
      })
      .returning()
    return row
  }

  async findVersionInTx(tx: DbTransaction, campaignId: string, version: number) {
    const [row] = await tx
      .select()
      .from(campaignVersions)
      .where(
        and(eq(campaignVersions.campaignId, campaignId), eq(campaignVersions.version, version)),
      )
    return row ?? null
  }

  async listVersions(campaignId: string) {
    return this.database.db
      .select()
      .from(campaignVersions)
      .where(eq(campaignVersions.campaignId, campaignId))
      .orderBy(desc(campaignVersions.version))
  }

  /** 用户可见活动:published/paused 展示;ended 从列表消失,详情仍可查。 */
  async listVisibleCampaigns(_now: Date) {
    return this.database.db
      .select()
      .from(campaigns)
      .where(inArray(campaigns.status, ['published', 'paused']))
      .orderBy(desc(campaigns.updatedAt))
  }

  async listClaimsByUser(campaignId: string, userId: string) {
    return this.database.db
      .select()
      .from(campaignClaims)
      .where(and(eq(campaignClaims.campaignId, campaignId), eq(campaignClaims.userId, userId)))
  }

  /** 该用户在所有注册奖励活动上的领取记录:注册奖励首版为每人全局一次。 */
  async listUserRegistrationClaims(userId: string) {
    return this.database.db
      .select({ claim: campaignClaims })
      .from(campaignClaims)
      .innerJoin(campaigns, eq(campaigns.id, campaignClaims.campaignId))
      .where(and(eq(campaignClaims.userId, userId), eq(campaigns.type, 'registration_bonus')))
  }

  async listClaimsByUserAll(userId: string) {
    return this.database.db.select().from(campaignClaims).where(eq(campaignClaims.userId, userId))
  }

  async findClaimByIdempotencyKey(userId: string, idempotencyKey: string) {
    const [row] = await this.database.db
      .select()
      .from(campaignClaims)
      .where(
        and(eq(campaignClaims.userId, userId), eq(campaignClaims.idempotencyKey, idempotencyKey)),
      )
    return row ?? null
  }

  /** 唯一约束是防重复领取的权威;冲突时返回 null,调用方回查已有领取。 */
  async insertClaimInTx(
    tx: DbTransaction,
    input: {
      userId: string
      campaignId: string
      version: number
      slot?: number
      status?: CampaignClaimRow['status']
      idempotencyKey?: string | null
    },
  ): Promise<CampaignClaimRow | null> {
    const rows = await tx
      .insert(campaignClaims)
      .values({
        userId: input.userId,
        campaignId: input.campaignId,
        version: input.version,
        slot: input.slot ?? 1,
        status: input.status ?? 'granted',
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .onConflictDoNothing({
        target: [campaignClaims.campaignId, campaignClaims.userId, campaignClaims.slot],
      })
      .returning()
    return rows[0] ?? null
  }

  async updateClaimStatusInTx(
    tx: DbTransaction,
    claimId: string,
    status: CampaignClaimRow['status'],
    grantId: string | null,
  ) {
    await tx.update(campaignClaims).set({ status, grantId }).where(eq(campaignClaims.id, claimId))
  }

  async lockClaimInTx(tx: DbTransaction, claimId: string): Promise<CampaignClaimRow | null> {
    const [row] = await tx
      .select()
      .from(campaignClaims)
      .where(eq(campaignClaims.id, claimId))
      .for('update')
    return row ?? null
  }

  async incrementCampaignTotalsInTx(tx: DbTransaction, campaignId: string, grantedCredits: number) {
    await tx
      .update(campaigns)
      .set({
        totalGrantedCredits: sql`${campaigns.totalGrantedCredits} + ${grantedCredits}`,
        totalClaimCount: sql`${campaigns.totalClaimCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId))
  }

  /** 注册奖励活动候选:发布中的优先于暂停/结束(等待补偿),同状态取最新版本。 */
  async lockRegistrationCampaignsInTx(tx: DbTransaction) {
    return tx
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.type, 'registration_bonus'),
          inArray(campaigns.status, ['published', 'paused', 'ended']),
        ),
      )
      .orderBy(
        sql`(case when ${campaigns.status} = 'published' then 1 else 0 end) desc`,
        desc(campaigns.currentVersion),
      )
      .for('update', { skipLocked: true })
  }

  async findUserById(userId: string) {
    const [row] = await this.database.db.select().from(users).where(eq(users.id, userId))
    return row ?? null
  }

  async insertAuditLogInTx(
    tx: DbTransaction,
    input: {
      actorUserId: string
      action: string
      targetType: string
      targetId: string
      beforeSnapshot?: Record<string, unknown> | null
      afterSnapshot?: Record<string, unknown> | null
      reason: string
      requestId?: string | null
    },
  ) {
    await tx.insert(adminAuditLogs).values({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeSnapshot: input.beforeSnapshot ?? null,
      afterSnapshot: input.afterSnapshot ?? null,
      reason: input.reason,
      requestId: input.requestId ?? null,
    })
  }
}
