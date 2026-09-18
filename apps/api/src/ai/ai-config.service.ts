import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { AiConfigRepository } from './ai-config.repository'
import type { AdminRole } from '../admin-access/admin-access.constants'

export interface AdminActor {
  actorUserId: string
  reason: string
  requestId?: string | null
}

const FEATURE_FLAG_KEYS = ['paper_explain'] as const

/**
 * AI 服务开关与价格的写入口。
 * 关闭开关仅阻止新受理,不删除已生成结果;未发布价格版本时计费视为不可用。
 */
@Injectable()
export class AiConfigService {
  constructor(@Inject(AiConfigRepository) private readonly repository: AiConfigRepository) {}

  async getServiceConfig() {
    const config = await this.repository.findServiceConfig()
    if (config) {
return config
}
    // 未初始化时按"全部关闭"处理(与 schema 默认一致),不隐式落库。
    return {
      aiEnabled: false,
      featureFlags: {} as Record<string, boolean>,
      costProtectionEnabled: true,
      dailyCostBudget: null,
      version: 1,
      updatedAt: new Date().toISOString(),
    }
  }

  async updateServiceConfig(input: {
    expectedVersion: number
    aiEnabled?: boolean
    featureFlags?: Record<string, boolean>
    costProtectionEnabled?: boolean
    dailyCostBudget?: string | null
    actor: AdminActor
  }) {
    if (input.featureFlags) {
      const unknown = Object.keys(input.featureFlags).filter(
        (key) => !FEATURE_FLAG_KEYS.includes(key as (typeof FEATURE_FLAG_KEYS)[number]),
      )
      if (unknown.length > 0) {
        throw new BadRequestException({
          code: 'AI_FEATURE_FLAG_UNKNOWN',
          message: `未知功能开关: ${unknown.join(', ')}`,
        })
      }
    }
    const before = await this.repository.findServiceConfig()
    if (before && before.version !== input.expectedVersion) {
      throw new BadRequestException({
        code: 'AI_CONFIG_VERSION_CONFLICT',
        message: 'AI 开关配置已变化,请刷新后重试',
      })
    }
    if (input.aiEnabled === true && !before?.aiEnabled) {
      const activePrice = await this.repository.findActivePrice('paper_explain')
      if (!activePrice) {
        throw new BadRequestException({
          code: 'AI_PRICE_MISSING',
          message: '必须先发布价格版本才能开启 AI 计费',
        })
      }
      const dailyBudget =
        input.dailyCostBudget !== undefined
          ? input.dailyCostBudget
          : (before?.dailyCostBudget ?? null)
      if (dailyBudget === null) {
        throw new BadRequestException({
          code: 'AI_COST_BUDGET_MISSING',
          message: '必须先设置每日成本预算才能开启 AI 计费',
        })
      }
    }
    return this.repository.transaction(async (tx) => {
      const row = await this.repository.upsertServiceConfigInTx(tx, {
        aiEnabled: input.aiEnabled,
        featureFlags: input.featureFlags,
        costProtectionEnabled: input.costProtectionEnabled,
        dailyCostBudget: input.dailyCostBudget,
      })
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'ai.update_config',
        targetType: 'ai_service_config',
        targetId: '1',
        beforeSnapshot: before
          ? {
              aiEnabled: before.aiEnabled,
              featureFlags: before.featureFlags,
              version: before.version,
            }
          : null,
        afterSnapshot: {
          aiEnabled: row.aiEnabled,
          featureFlags: row.featureFlags,
          version: row.version,
        },
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return {
        aiEnabled: row.aiEnabled,
        featureFlags: row.featureFlags,
        costProtectionEnabled: row.costProtectionEnabled,
        dailyCostBudget: row.dailyCostBudget,
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
      }
    })
  }

  async listPrices() {
    return this.repository.listPrices()
  }

  async getActivePrice(action: string) {
    return this.repository.findActivePrice(action)
  }

  async publishPrice(input: {
    action: 'paper_explain'
    priceCredits: number
    configSnapshot: {
      model: string
      maxInputTokens: number
      maxOutputTokens: number
      estimatedCostPerRun: string
      currency: string
    }
    actor: AdminActor
    actorRole?: AdminRole
  }) {
    return this.repository.transaction(async (tx) => {
      const nextVersion = (await this.repository.findMaxVersionInTx(tx, input.action)) + 1
      await this.repository.deactivateActivePricesInTx(tx, input.action)
      const row = await this.repository.insertPriceInTx(tx, {
        action: input.action,
        version: nextVersion,
        priceCredits: input.priceCredits,
        configSnapshot: input.configSnapshot,
        publishedBy: input.actor.actorUserId,
      })
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'ai.publish_price',
        targetType: 'ai_price_version',
        targetId: row.id,
        afterSnapshot: {
          action: row.action,
          version: row.version,
          priceCredits: row.priceCredits,
          configSnapshot: row.configSnapshot,
        },
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return row
    })
  }
}
