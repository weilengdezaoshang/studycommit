import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AdminAiProviderConfig } from '@studycommit/rpc-contracts/admin'
import type { AppEnv } from '../config/env'
import { RedisService } from '../infrastructure/redis.service'
import type { AdminActor } from './ai-config.service'
import { AiConfigRepository, type AiProviderConfigRow } from './ai-config.repository'
import {
  createAiProviderFromEnv,
  createAiProviderFromOptions,
  type AiProtocol,
  type AiProvider,
  type AiProviderOptions,
} from './ai-provider'
import { probeProviderConnection } from './provider-connection'
import { createProviderFetch } from './provider-http'
import { assertProviderBaseUrl, defaultBaseUrl, parseTrustedBaseUrls } from './provider-endpoint'
import {
  decryptSecret,
  encryptSecret,
  maskApiKey,
  parseEncryptionKey,
  requireEncryptionKey,
} from './provider-secret'

const TEST_RATE_LIMIT = 5
const TEST_RATE_WINDOW_SECONDS = 60
const TEST_TIMEOUT_MS = 8_000
const API_KEY_MAX = 4096

export const AI_PROVIDER_CONFIG_ERROR = {
  versionConflict: {
    code: 'AI_PROVIDER_VERSION_CONFLICT',
    message: '服务商配置已变化,请刷新后重试',
  },
  keyRequired: {
    code: 'AI_PROVIDER_KEY_REQUIRED',
    message: '首次保存必须填写 API Key',
  },
  keyInvalid: {
    code: 'AI_PROVIDER_KEY_INVALID',
    message: '请填写有效 API Key',
  },
  notConfigured: {
    code: 'AI_PROVIDER_NOT_CONFIGURED',
    message: '尚未保存服务商配置,无法停用',
  },
  operationConflict: {
    code: 'AI_PROVIDER_OPERATION_CONFLICT',
    message: '操作标识已用于不同配置,请勿复用',
  },
} as const

export interface RuntimeProviderSnapshot {
  source: 'database' | 'env'
  protocol: AiProtocol
  options: AiProviderOptions
  version: number | null
}

function publicSnapshot(row: AiProviderConfigRow): Record<string, unknown> {
  return {
    protocol: row.protocol,
    baseUrl: row.baseUrl,
    model: row.model,
    hasApiKey: Boolean(row.apiKeyCiphertext),
    apiKeyHint: row.apiKeyHint,
    status: row.status,
    version: row.version,
  }
}

function displayStatus(row: AiProviderConfigRow | null): AdminAiProviderConfig['displayStatus'] {
  if (!row) {
    return 'unconfigured'
  }
  if (row.status === 'disabled') {
    return 'disabled'
  }
  if (!row.apiKeyCiphertext) {
    return 'unconfigured'
  }
  if (row.lastTestedVersion === row.version && row.lastTestStatus === 'success') {
    return 'connected'
  }
  if (row.lastTestedVersion === row.version && row.lastTestStatus === 'failed') {
    return 'connection_failed'
  }
  return 'configured_unverified'
}

function normalizeApiKey(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function assertApiKeyShape(apiKey: string) {
  if (apiKey.length > API_KEY_MAX || apiKey.includes('\0') || /[\r\n]/.test(apiKey)) {
    throw new BadRequestException(AI_PROVIDER_CONFIG_ERROR.keyInvalid)
  }
}

@Injectable()
export class AiProviderConfigService {
  constructor(
    @Inject(AiConfigRepository) private readonly repository: AiConfigRepository,
    @Inject(ConfigService) private readonly config: ConfigService<AppEnv>,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  async getView(): Promise<AdminAiProviderConfig> {
    const row = await this.repository.findProviderConfig()
    const billed = await this.repository.findActivePrice('paper_explain')
    return this.toView(row, billed?.configSnapshot.model ?? null)
  }

  async resolveRuntime(): Promise<RuntimeProviderSnapshot | null> {
    const row = await this.repository.findProviderConfig()
    if (row) {
      if (row.status !== 'active' || !row.apiKeyCiphertext) {
        return null
      }
      const key = parseEncryptionKey(this.config.get('AI_PROVIDER_ENCRYPTION_KEY'))
      if (!key) {
        return null
      }
      let apiKey: string
      try {
        apiKey = decryptSecret(row.apiKeyCiphertext, key)
      } catch {
        return null
      }
      return {
        source: 'database',
        protocol: row.protocol,
        version: row.version,
        options: {
          baseUrl: row.baseUrl,
          apiKey,
          model: row.model,
          timeoutMs: this.config.get('AI_TIMEOUT_MS') ?? 15_000,
        },
      }
    }
    const fromEnv = createAiProviderFromEnv(this.config)
    if (!fromEnv) {
      return null
    }
    return {
      source: 'env',
      protocol: fromEnv.protocol,
      version: null,
      options: {
        baseUrl: this.config.get('AI_BASE_URL') ?? defaultBaseUrl(fromEnv.protocol),
        apiKey: this.config.get('AI_API_KEY') ?? '',
        model: fromEnv.model,
        timeoutMs: this.config.get('AI_TIMEOUT_MS') ?? 15_000,
      },
    }
  }

  createProvider(snapshot: RuntimeProviderSnapshot, modelOverride?: string): AiProvider {
    const trusted = parseTrustedBaseUrls(this.config.get('AI_PROVIDER_TRUSTED_BASE_URLS'))
    return createAiProviderFromOptions(snapshot.protocol, {
      ...snapshot.options,
      model:
        modelOverride && modelOverride.trim().length > 0 ? modelOverride : snapshot.options.model,
      fetchImpl: snapshot.options.fetchImpl ?? createProviderFetch(trusted),
    })
  }

  async getOperation(operationId: string) {
    const row = await this.repository.findProviderOperation(operationId)
    if (!row) {
      return null
    }
    const current = await this.repository.findProviderConfig()
    return {
      operationId: row.operationId,
      kind: row.kind,
      protocol: row.protocol,
      baseUrl: row.baseUrl,
      model: row.model,
      keyChanged: row.keyChanged,
      versionAfter: row.versionAfter,
      currentVersion: current?.version ?? 0,
      isCurrent: current?.lastOperationId === row.operationId,
      createdAt: row.createdAt.toISOString(),
    }
  }

  async update(input: {
    expectedVersion: number
    protocol: AiProtocol
    baseUrl?: string
    model: string
    apiKey?: string
    operationId: string
    actor: AdminActor
  }): Promise<AdminAiProviderConfig> {
    const incomingKey = normalizeApiKey(input.apiKey)
    if (incomingKey) {
      assertApiKeyShape(incomingKey)
    }
    const trusted = parseTrustedBaseUrls(this.config.get('AI_PROVIDER_TRUSTED_BASE_URLS'))
    const baseUrl = await assertProviderBaseUrl(
      input.baseUrl && input.baseUrl.trim().length > 0
        ? input.baseUrl.trim()
        : defaultBaseUrl(input.protocol),
      trusted,
    )
    const billed = await this.repository.findActivePrice('paper_explain')
    const keyChanged = incomingKey !== null
    return this.repository.transaction(async (tx) => {
      const existingOp = await this.repository.findProviderOperationInTx(tx, input.operationId)
      if (existingOp) {
        const same =
          existingOp.kind === 'save' &&
          existingOp.protocol === input.protocol &&
          existingOp.baseUrl === baseUrl &&
          existingOp.model === input.model.trim() &&
          existingOp.keyChanged === keyChanged
        if (!same) {
          throw new ConflictException(AI_PROVIDER_CONFIG_ERROR.operationConflict)
        }
        const current = await this.repository.lockProviderConfigInTx(tx)
        return this.toView(current, billed?.configSnapshot.model ?? null)
      }
      const before = await this.repository.lockProviderConfigInTx(tx)
      const currentVersion = before?.version ?? 0
      if (currentVersion !== input.expectedVersion) {
        throw new ConflictException(AI_PROVIDER_CONFIG_ERROR.versionConflict)
      }
      if (!before && incomingKey === null) {
        throw new BadRequestException(AI_PROVIDER_CONFIG_ERROR.keyRequired)
      }
      let ciphertext: string
      let hint: string
      if (incomingKey) {
        const encryptionKey = requireEncryptionKey(this.config.get('AI_PROVIDER_ENCRYPTION_KEY'))
        ciphertext = encryptSecret(incomingKey, encryptionKey)
        hint = maskApiKey(incomingKey)
      } else if (before?.apiKeyCiphertext) {
        ciphertext = before.apiKeyCiphertext
        hint = before.apiKeyHint ?? '••••'
      } else {
        throw new BadRequestException(AI_PROVIDER_CONFIG_ERROR.keyRequired)
      }
      let saved: AiProviderConfigRow
      if (!before) {
        saved = await this.repository.insertProviderConfigInTx(tx, {
          protocol: input.protocol,
          baseUrl,
          model: input.model.trim(),
          apiKeyCiphertext: ciphertext,
          apiKeyHint: hint,
          lastOperationId: input.operationId,
          updatedBy: input.actor.actorUserId,
        })
      } else {
        const updated = await this.repository.updateProviderConfigInTx(tx, before.version, {
          protocol: input.protocol,
          baseUrl,
          model: input.model.trim(),
          apiKeyCiphertext: ciphertext,
          apiKeyHint: hint,
          status: 'active',
          lastTestStatus: 'unverified',
          lastTestedAt: null,
          lastTestedVersion: null,
          lastOperationId: input.operationId,
          updatedBy: input.actor.actorUserId,
        })
        if (!updated) {
          throw new ConflictException(AI_PROVIDER_CONFIG_ERROR.versionConflict)
        }
        saved = updated
      }
      await this.repository.insertProviderOperationInTx(tx, {
        operationId: input.operationId,
        kind: 'save',
        protocol: saved.protocol,
        baseUrl: saved.baseUrl,
        model: saved.model,
        keyChanged,
        versionAfter: saved.version,
        actorUserId: input.actor.actorUserId,
      })
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'ai.update_provider',
        targetType: 'ai_provider_config',
        targetId: '1',
        beforeSnapshot: before ? publicSnapshot(before) : null,
        afterSnapshot: publicSnapshot(saved),
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return this.toView(saved, billed?.configSnapshot.model ?? null)
    })
  }

  async disable(input: {
    expectedVersion: number
    operationId: string
    actor: AdminActor
  }): Promise<AdminAiProviderConfig> {
    const billed = await this.repository.findActivePrice('paper_explain')
    return this.repository.transaction(async (tx) => {
      const existingOp = await this.repository.findProviderOperationInTx(tx, input.operationId)
      if (existingOp) {
        if (existingOp.kind !== 'disable') {
          throw new ConflictException(AI_PROVIDER_CONFIG_ERROR.operationConflict)
        }
        const current = await this.repository.lockProviderConfigInTx(tx)
        return this.toView(current, billed?.configSnapshot.model ?? null)
      }
      const before = await this.repository.lockProviderConfigInTx(tx)
      if (!before) {
        throw new BadRequestException(AI_PROVIDER_CONFIG_ERROR.notConfigured)
      }
      if (before.version !== input.expectedVersion) {
        throw new ConflictException(AI_PROVIDER_CONFIG_ERROR.versionConflict)
      }
      const saved = await this.repository.updateProviderConfigInTx(tx, before.version, {
        status: 'disabled',
        lastTestStatus: 'unverified',
        lastTestedAt: null,
        lastTestedVersion: null,
        lastOperationId: input.operationId,
        updatedBy: input.actor.actorUserId,
      })
      if (!saved) {
        throw new ConflictException(AI_PROVIDER_CONFIG_ERROR.versionConflict)
      }
      await this.repository.insertProviderOperationInTx(tx, {
        operationId: input.operationId,
        kind: 'disable',
        protocol: saved.protocol,
        baseUrl: saved.baseUrl,
        model: saved.model,
        keyChanged: false,
        versionAfter: saved.version,
        actorUserId: input.actor.actorUserId,
      })
      await this.repository.insertAuditLogInTx(tx, {
        actorUserId: input.actor.actorUserId,
        action: 'ai.disable_provider',
        targetType: 'ai_provider_config',
        targetId: '1',
        beforeSnapshot: publicSnapshot(before),
        afterSnapshot: publicSnapshot(saved),
        reason: input.actor.reason,
        requestId: input.actor.requestId ?? null,
      })
      return this.toView(saved, billed?.configSnapshot.model ?? null)
    })
  }

  async test(input: {
    protocol: AiProtocol
    baseUrl?: string
    model: string
    apiKey?: string
    actorUserId: string
    fetchImpl?: typeof fetch
  }) {
    await this.assertTestRateLimit(input.actorUserId)
    const incomingKey = normalizeApiKey(input.apiKey)
    if (incomingKey) {
      assertApiKeyShape(incomingKey)
    }
    const trusted = parseTrustedBaseUrls(this.config.get('AI_PROVIDER_TRUSTED_BASE_URLS'))
    let baseUrl: string
    try {
      baseUrl = await assertProviderBaseUrl(
        input.baseUrl && input.baseUrl.trim().length > 0
          ? input.baseUrl.trim()
          : defaultBaseUrl(input.protocol),
        trusted,
      )
    } catch (error) {
      if (error instanceof BadRequestException) {
        return {
          ok: false as const,
          code: 'unsafe_url' as const,
          message: '接口地址不受支持',
          testedAt: new Date().toISOString(),
          persisted: false,
        }
      }
      throw error
    }
    const row = await this.repository.findProviderConfig()
    let apiKey = incomingKey
    if (!apiKey) {
      if (!row?.apiKeyCiphertext) {
        throw new BadRequestException(AI_PROVIDER_CONFIG_ERROR.keyRequired)
      }
      const encryptionKey = parseEncryptionKey(this.config.get('AI_PROVIDER_ENCRYPTION_KEY'))
      if (!encryptionKey) {
        throw new ServiceUnavailableException({
          code: 'AI_PROVIDER_ENCRYPTION_KEY_MISSING',
          message: '未配置加密主密钥，无法使用已保存密钥进行测试',
        })
      }
      apiKey = decryptSecret(row.apiKeyCiphertext, encryptionKey)
    }
    const probed = await probeProviderConnection({
      protocol: input.protocol,
      baseUrl,
      model: input.model.trim(),
      apiKey,
      timeoutMs: TEST_TIMEOUT_MS,
      fetchImpl: input.fetchImpl,
      trustedOrigins: trusted,
    })
    const matchesSaved =
      Boolean(row) &&
      incomingKey === null &&
      row!.status === 'active' &&
      row!.protocol === input.protocol &&
      row!.baseUrl === baseUrl &&
      row!.model === input.model.trim()
    let persisted = false
    if (matchesSaved && row) {
      const updated = await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockProviderConfigInTx(tx)
        if (!current || current.version !== row.version) {
          return null
        }
        return this.repository.updateProviderConfigInTx(tx, current.version, {
          lastTestStatus: probed.ok ? 'success' : 'failed',
          lastTestedAt: new Date(),
          lastTestedVersion: current.version,
          bumpVersion: false,
        })
      })
      persisted = Boolean(updated)
    }
    return {
      ok: probed.ok,
      code: probed.code,
      message: probed.message,
      testedAt: new Date().toISOString(),
      persisted,
    }
  }

  private async assertTestRateLimit(userId: string) {
    const count = await this.redis.incrWithTtl(
      `rl:ai-provider-test:${userId}`,
      TEST_RATE_WINDOW_SECONDS,
    )
    if (count > TEST_RATE_LIMIT) {
      throw new HttpException(
        {
          code: 'AI_PROVIDER_TEST_RATE_LIMITED',
          message: '连接测试过于频繁，请稍后再试',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }

  private envFallbackActive(row: AiProviderConfigRow | null): boolean {
    if (row) {
      return false
    }
    return Boolean(this.config.get('AI_API_KEY') && this.config.get('AI_MODEL'))
  }

  private toView(
    row: AiProviderConfigRow | null,
    billedModel: string | null,
  ): AdminAiProviderConfig {
    if (!row) {
      return {
        displayStatus: 'unconfigured',
        protocol: null,
        baseUrl: null,
        model: null,
        hasApiKey: false,
        apiKeyHint: null,
        lastTestStatus: null,
        lastTestedAt: null,
        billedModel,
        envFallbackActive: this.envFallbackActive(null),
        version: 0,
        lastOperationId: null,
        updatedAt: null,
      }
    }
    const lastTestFresh = row.lastTestedVersion === row.version
    return {
      displayStatus: displayStatus(row),
      protocol: row.protocol,
      baseUrl: row.baseUrl,
      model: row.model,
      hasApiKey: Boolean(row.apiKeyCiphertext),
      apiKeyHint: row.apiKeyHint,
      lastTestStatus: lastTestFresh ? (row.lastTestStatus ?? null) : 'unverified',
      lastTestedAt: lastTestFresh && row.lastTestedAt ? row.lastTestedAt.toISOString() : null,
      billedModel,
      envFallbackActive: false,
      version: row.version,
      lastOperationId: row.lastOperationId,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
