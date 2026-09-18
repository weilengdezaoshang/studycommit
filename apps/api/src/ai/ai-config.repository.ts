import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import {
  adminAuditLogs,
  aiPriceVersions,
  aiProviderConfig,
  aiServiceConfig,
} from '../database/schema'

export type AiServiceConfigRow = typeof aiServiceConfig.$inferSelect
export type AiPriceVersionRow = typeof aiPriceVersions.$inferSelect
export type AiProviderConfigRow = typeof aiProviderConfig.$inferSelect

export interface ServiceConfigSnapshot {
  aiEnabled: boolean
  featureFlags: Record<string, boolean>
  costProtectionEnabled: boolean
  dailyCostBudget: string | null
  version: number
  updatedAt: string
}

/** AI 服务开关与价格版本;计费受理(阶段D)读取同一数据源,不引入第二份配置。 */
@Injectable()
export class AiConfigRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  transaction<T>(
    work: (tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return this.database.db.transaction(work)
  }

  async findServiceConfig(): Promise<ServiceConfigSnapshot | null> {
    const [row] = await this.database.db
      .select()
      .from(aiServiceConfig)
      .where(eq(aiServiceConfig.id, 1))
    if (!row) {
return null
}
    return {
      aiEnabled: row.aiEnabled,
      featureFlags: row.featureFlags,
      costProtectionEnabled: row.costProtectionEnabled,
      dailyCostBudget: row.dailyCostBudget,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  async upsertServiceConfigInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    patch: {
      aiEnabled?: boolean
      featureFlags?: Record<string, boolean>
      costProtectionEnabled?: boolean
      dailyCostBudget?: string | null
    },
  ) {
    const [row] = await tx
      .insert(aiServiceConfig)
      .values({
        id: 1,
        aiEnabled: patch.aiEnabled ?? false,
        featureFlags: patch.featureFlags ?? {},
        costProtectionEnabled: patch.costProtectionEnabled ?? true,
        dailyCostBudget: patch.dailyCostBudget ?? null,
        version: 1,
      })
      .onConflictDoUpdate({
        target: aiServiceConfig.id,
        set: {
          ...(patch.aiEnabled !== undefined ? { aiEnabled: patch.aiEnabled } : {}),
          ...(patch.featureFlags !== undefined ? { featureFlags: patch.featureFlags } : {}),
          ...(patch.costProtectionEnabled !== undefined
            ? { costProtectionEnabled: patch.costProtectionEnabled }
            : {}),
          ...(patch.dailyCostBudget !== undefined
            ? { dailyCostBudget: patch.dailyCostBudget }
            : {}),
          version: sql`${aiServiceConfig.version} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row
  }

  async listPrices(): Promise<AiPriceVersionRow[]> {
    return this.database.db.select().from(aiPriceVersions).orderBy(desc(aiPriceVersions.createdAt))
  }

  async findActivePrice(action: string): Promise<AiPriceVersionRow | null> {
    const [row] = await this.database.db
      .select()
      .from(aiPriceVersions)
      .where(and(eq(aiPriceVersions.action, action), eq(aiPriceVersions.isActive, true)))
      .orderBy(desc(aiPriceVersions.version))
      .limit(1)
    return row ?? null
  }

  async findMaxVersionInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    action: string,
  ) {
    const [row] = await tx
      .select({ maxVersion: sql<number>`coalesce(max(${aiPriceVersions.version}), 0)::int` })
      .from(aiPriceVersions)
      .where(eq(aiPriceVersions.action, action))
    return row?.maxVersion ?? 0
  }

  async deactivateActivePricesInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    action: string,
  ) {
    await tx
      .update(aiPriceVersions)
      .set({ isActive: false })
      .where(and(eq(aiPriceVersions.action, action), eq(aiPriceVersions.isActive, true)))
  }

  async insertPriceInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    input: {
      action: string
      version: number
      priceCredits: number
      configSnapshot: AiPriceVersionRow['configSnapshot']
      publishedBy: string
    },
  ): Promise<AiPriceVersionRow> {
    const [row] = await tx
      .insert(aiPriceVersions)
      .values({
        action: input.action,
        version: input.version,
        priceCredits: input.priceCredits,
        configSnapshot: input.configSnapshot,
        isActive: true,
        publishedAt: new Date(),
        publishedBy: input.publishedBy,
      })
      .returning()
    return row
  }

  async findProviderConfig(): Promise<AiProviderConfigRow | null> {
    const [row] = await this.database.db
      .select()
      .from(aiProviderConfig)
      .where(eq(aiProviderConfig.id, 1))
    return row ?? null
  }

  async lockProviderConfigInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
  ): Promise<AiProviderConfigRow | null> {
    await tx.execute(sql`select pg_advisory_xact_lock(921001)`)
    const [row] = await tx.select().from(aiProviderConfig).where(eq(aiProviderConfig.id, 1))
    return row ?? null
  }

  async insertProviderConfigInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    input: {
      protocol: AiProviderConfigRow['protocol']
      baseUrl: string
      model: string
      apiKeyCiphertext: string
      apiKeyHint: string
      updatedBy: string
    },
  ): Promise<AiProviderConfigRow> {
    const [row] = await tx
      .insert(aiProviderConfig)
      .values({
        id: 1,
        protocol: input.protocol,
        baseUrl: input.baseUrl,
        model: input.model,
        apiKeyCiphertext: input.apiKeyCiphertext,
        apiKeyHint: input.apiKeyHint,
        status: 'active',
        lastTestStatus: 'unverified',
        lastTestedAt: null,
        lastTestedVersion: null,
        version: 1,
        updatedBy: input.updatedBy,
      })
      .returning()
    return row
  }

  async updateProviderConfigInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    expectedVersion: number,
    patch: {
      protocol?: AiProviderConfigRow['protocol']
      baseUrl?: string
      model?: string
      apiKeyCiphertext?: string
      apiKeyHint?: string
      status?: AiProviderConfigRow['status']
      lastTestStatus?: AiProviderConfigRow['lastTestStatus']
      lastTestedAt?: Date | null
      lastTestedVersion?: number | null
      updatedBy?: string
      bumpVersion?: boolean
    },
  ): Promise<AiProviderConfigRow | null> {
    const [row] = await tx
      .update(aiProviderConfig)
      .set({
        ...(patch.protocol !== undefined ? { protocol: patch.protocol } : {}),
        ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
        ...(patch.model !== undefined ? { model: patch.model } : {}),
        ...(patch.apiKeyCiphertext !== undefined
          ? { apiKeyCiphertext: patch.apiKeyCiphertext }
          : {}),
        ...(patch.apiKeyHint !== undefined ? { apiKeyHint: patch.apiKeyHint } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.lastTestStatus !== undefined ? { lastTestStatus: patch.lastTestStatus } : {}),
        ...(patch.lastTestedAt !== undefined ? { lastTestedAt: patch.lastTestedAt } : {}),
        ...(patch.lastTestedVersion !== undefined
          ? { lastTestedVersion: patch.lastTestedVersion }
          : {}),
        ...(patch.updatedBy !== undefined ? { updatedBy: patch.updatedBy } : {}),
        ...(patch.bumpVersion === false ? {} : { version: sql`${aiProviderConfig.version} + 1` }),
        updatedAt: new Date(),
      })
      .where(and(eq(aiProviderConfig.id, 1), eq(aiProviderConfig.version, expectedVersion)))
      .returning()
    return row ?? null
  }

  async insertAuditLogInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
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
