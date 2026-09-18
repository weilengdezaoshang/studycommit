import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, ilike, isNotNull, lte, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import {
  adminAuditLogs,
  adminRoles,
  agentRuns,
  aiCostBudgets,
  aiPriceVersions,
  aiServiceConfig,
  campaignClaims,
  campaignVersions,
  campaigns,
  creditAccounts,
  creditGrants,
  creditLedger,
  creditReservations,
  users,
} from '../database/schema'
import { decodeCursor, encodeCursor } from '../common/cursor'

/**
 * 管理端聚合查询:全部只读;数据来自后端聚合,不把全量流水拉到浏览器计算。
 * 分页游标统一为 (createdAt,id) 倒序。
 */
@Injectable()
export class AdminRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async listCampaigns(input: { status?: string | null; limit: number; cursor?: string | null }) {
    const cursor = decodeCursor(input.cursor)
    const rows = await this.database.db
      .select()
      .from(campaigns)
      .where(
        and(
          input.status ? eq(campaigns.status, input.status as never) : undefined,
          cursor
            ? sql`(${campaigns.createdAt}, ${campaigns.id}) < (${cursor.at}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(campaigns.createdAt), desc(campaigns.id))
      .limit(input.limit + 1)
    const hasNext = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    return {
      items: page,
      nextCursor: hasNext
        ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
        : null,
    }
  }

  async getCampaignDetail(campaignId: string) {
    const [campaign] = await this.database.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
    if (!campaign) {
return null
}
    const versions = await this.database.db
      .select()
      .from(campaignVersions)
      .where(eq(campaignVersions.campaignId, campaignId))
      .orderBy(desc(campaignVersions.version))
    return { campaign, versions }
  }

  async listClaims(input: { campaignId: string; limit: number; cursor?: string | null }) {
    const cursor = decodeCursor(input.cursor)
    const rows = await this.database.db
      .select()
      .from(campaignClaims)
      .where(
        and(
          eq(campaignClaims.campaignId, input.campaignId),
          cursor
            ? sql`(${campaignClaims.createdAt}, ${campaignClaims.id}) < (${cursor.at}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(campaignClaims.createdAt), desc(campaignClaims.id))
      .limit(input.limit + 1)
    const hasNext = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    return {
      items: page,
      nextCursor: hasNext
        ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
        : null,
    }
  }

  async searchCreditUsers(input: { query: string; limit: number }) {
    const asUuid = input.query.trim()
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(asUuid)
    return this.database.db
      .select({
        userId: users.id,
        nickname: users.nickname,
        available: creditAccounts.available,
        reserved: creditAccounts.reserved,
        lifetimeGranted: creditAccounts.lifetimeGranted,
      })
      .from(users)
      .leftJoin(creditAccounts, eq(creditAccounts.userId, users.id))
      .where(isUuid ? eq(users.id, asUuid) : ilike(users.nickname, `${input.query.trim()}%`))
      .limit(input.limit)
  }

  async getCreditUserDetail(userId: string) {
    const [user] = await this.database.db
      .select({
        userId: users.id,
        nickname: users.nickname,
        available: creditAccounts.available,
        reserved: creditAccounts.reserved,
        lifetimeGranted: creditAccounts.lifetimeGranted,
      })
      .from(users)
      .leftJoin(creditAccounts, eq(creditAccounts.userId, users.id))
      .where(eq(users.id, userId))
    if (!user) {
return null
}
    const grants = await this.database.db
      .select()
      .from(creditGrants)
      .where(eq(creditGrants.userId, userId))
      .orderBy(desc(creditGrants.createdAt))
      .limit(100)
    return { user, grants }
  }

  async listLedger(input: {
    userId?: string | null
    campaignId?: string | null
    kind?: string | null
    limit: number
    cursor?: string | null
  }) {
    const cursor = decodeCursor(input.cursor)
    const rows = await this.database.db
      .select()
      .from(creditLedger)
      .where(
        and(
          input.userId ? eq(creditLedger.userId, input.userId) : undefined,
          input.campaignId ? eq(creditLedger.campaignId, input.campaignId) : undefined,
          input.kind ? eq(creditLedger.kind, input.kind as never) : undefined,
          cursor
            ? sql`(${creditLedger.createdAt}, ${creditLedger.eventId}) < (${cursor.at}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(creditLedger.createdAt), desc(creditLedger.eventId))
      .limit(input.limit + 1)
    const hasNext = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    return {
      items: page,
      nextCursor: hasNext
        ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].eventId)
        : null,
    }
  }

  async listRuns(input: {
    status?: string | null
    runId?: string | null
    limit: number
    cursor?: string | null
  }) {
    const cursor = decodeCursor(input.cursor)
    const rows = await this.database.db
      .select({
        run: agentRuns,
        reservation: creditReservations,
      })
      .from(agentRuns)
      .leftJoin(creditReservations, eq(creditReservations.runId, agentRuns.id))
      .where(
        and(
          input.status ? eq(agentRuns.status, input.status as never) : undefined,
          input.runId ? eq(agentRuns.id, input.runId) : undefined,
          cursor
            ? sql`(${agentRuns.createdAt}, ${agentRuns.id}) < (${cursor.at}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(agentRuns.createdAt), desc(agentRuns.id))
      .limit(input.limit + 1)
    const hasNext = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    return {
      items: page,
      nextCursor: hasNext
        ? encodeCursor(page[page.length - 1].run.createdAt, page[page.length - 1].run.id)
        : null,
    }
  }

  async listAuditLogs(input: {
    actorUserId?: string | null
    targetType?: string | null
    targetId?: string | null
    limit: number
    cursor?: string | null
  }) {
    const cursor = decodeCursor(input.cursor)
    const rows = await this.database.db
      .select()
      .from(adminAuditLogs)
      .where(
        and(
          input.actorUserId ? eq(adminAuditLogs.actorUserId, input.actorUserId) : undefined,
          input.targetType ? eq(adminAuditLogs.targetType, input.targetType) : undefined,
          input.targetId ? eq(adminAuditLogs.targetId, input.targetId) : undefined,
          cursor
            ? sql`(${adminAuditLogs.createdAt}, ${adminAuditLogs.id}) < (${cursor.at}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id))
      .limit(input.limit + 1)
    const hasNext = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    return {
      items: page,
      nextCursor: hasNext
        ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
        : null,
    }
  }

  /** 运营概览:一次聚合查询,不导出全量流水。 */
  async overview() {
    const now = new Date()
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const result = await this.database.db.execute<{
      published_count: number
      granted_total: number
      claim_total: number
      reserved_total: number
      pending_compensation: number
      runs_pending: number
      runs_completed_today: number
      runs_failed_today: number
      long_frozen: number
    }>(sql`
      select
        (select count(*)::int from campaigns where status in ('published','paused')) as published_count,
        (select coalesce(sum(total_granted_credits),0)::int from campaigns) as granted_total,
        (select coalesce(sum(total_claim_count),0)::int from campaigns) as claim_total,
        (select coalesce(sum(reserved),0)::int from credit_accounts) as reserved_total,
        (select count(*)::int from campaign_claims where status = 'pending_compensation') as pending_compensation,
        (select count(*)::int from agent_runs where status = 'pending') as runs_pending,
        (select count(*)::int from agent_runs where status = 'completed' and updated_at >= ${dayStart.toISOString()}) as runs_completed_today,
        (select count(*)::int from agent_runs where status = 'failed' and updated_at >= ${dayStart.toISOString()}) as runs_failed_today,
        (select count(*)::int from credit_reservations where status = 'active' and deadline_at < now()) as long_frozen
    `)
    const row = result.rows[0]
    const [config] = await this.database.db
      .select()
      .from(aiServiceConfig)
      .where(eq(aiServiceConfig.id, 1))
    const [activePrice] = await this.database.db
      .select({ version: aiPriceVersions.version })
      .from(aiPriceVersions)
      .where(and(eq(aiPriceVersions.isActive, true), eq(aiPriceVersions.action, 'paper_explain')))
      .limit(1)
    const [budget] = await this.database.db
      .select()
      .from(aiCostBudgets)
      .where(and(isNotNull(aiCostBudgets.periodStart), lte(aiCostBudgets.periodStart, dayStart)))
      .orderBy(desc(aiCostBudgets.periodStart))
      .limit(1)
    return {
      serverNow: now.toISOString(),
      campaigns: {
        publishedCount: row.published_count,
        totalGrantedCredits: row.granted_total,
        totalClaimCount: row.claim_total,
      },
      ai: {
        enabled: config?.aiEnabled ?? false,
        activePriceVersion: activePrice?.version ?? null,
        runs: {
          pending: row.runs_pending,
          completedToday: row.runs_completed_today,
          failedToday: row.runs_failed_today,
          longFrozen: row.long_frozen,
        },
        cost: {
          reservedToday: budget?.reservedCost ?? '0',
          confirmedToday: budget?.confirmedCost ?? '0',
          dailyBudget: budget?.budget ?? null,
        },
      },
      credits: {
        reservedTotal: row.reserved_total,
        pendingCompensationCount: row.pending_compensation,
      },
    }
  }

  async listAdminRoleOwners() {
    return this.database.db.select().from(adminRoles)
  }

  /** 用户名下是否存在引用(用于删除保护等运维检查)。 */
  async findUsersBySearchTerm(term: string, limit: number) {
    return this.database.db
      .select()
      .from(users)
      .where(or(ilike(users.nickname, `${term}%`), eq(users.id, term)))
      .limit(limit)
  }
}
