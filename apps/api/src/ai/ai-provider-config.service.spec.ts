import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn().mockResolvedValue([{ address: '1.1.1.1', family: 4 }]),
}))

import { ConflictException, HttpException } from '@nestjs/common'
import { encryptSecret, parseEncryptionKey } from './provider-secret'
import { AiProviderConfigService } from './ai-provider-config.service'

const ENCRYPTION_KEY = '00'.repeat(32)
const KEY = parseEncryptionKey(ENCRYPTION_KEY)!
const actor = { actorUserId: '11111111-1111-4111-8111-111111111111', reason: '测试保存服务商' }

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-test',
    apiKeyCiphertext: encryptSecret('sk-stored-not-real', KEY),
    apiKeyHint: '••••real',
    status: 'active',
    lastTestStatus: 'success',
    lastTestedAt: new Date('2026-09-18T00:00:00.000Z'),
    lastTestedVersion: 2,
    version: 2,
    lastOperationId: null,
    updatedAt: new Date('2026-09-18T00:00:00.000Z'),
    updatedBy: actor.actorUserId,
    ...overrides,
  }
}

const OP_SAVE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OP_OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('AiProviderConfigService', () => {
  const repository = {
    findProviderConfig: vi.fn(),
    findActivePrice: vi.fn(),
    transaction: vi.fn(),
    lockProviderConfigInTx: vi.fn(),
    insertProviderConfigInTx: vi.fn(),
    updateProviderConfigInTx: vi.fn(),
    insertAuditLogInTx: vi.fn(),
    findProviderOperation: vi.fn(),
    findProviderOperationInTx: vi.fn(),
    insertProviderOperationInTx: vi.fn(),
  }
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'AI_PROVIDER_ENCRYPTION_KEY') {
        return ENCRYPTION_KEY
      }
      if (key === 'NODE_ENV') {
        return 'test'
      }
      if (key === 'AI_TIMEOUT_MS') {
        return 15_000
      }
      return undefined
    }),
  }
  const redis = { incrWithTtl: vi.fn().mockResolvedValue(1) }
  let service: AiProviderConfigService

  beforeEach(() => {
    vi.clearAllMocks()
    redis.incrWithTtl.mockResolvedValue(1)
    repository.findActivePrice.mockResolvedValue(null)
    repository.findProviderOperation.mockResolvedValue(null)
    repository.findProviderOperationInTx.mockResolvedValue(null)
    repository.transaction.mockImplementation(async (work: (tx: unknown) => unknown) => work({}))
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_PROVIDER_ENCRYPTION_KEY') {
        return ENCRYPTION_KEY
      }
      if (key === 'NODE_ENV') {
        return 'test'
      }
      if (key === 'AI_TIMEOUT_MS') {
        return 15_000
      }
      return undefined
    })
    service = new AiProviderConfigService(repository as never, config as never, redis as never)
  })

  it('未建立数据库配置时回退环境变量,停用后不再回退', async () => {
    repository.findProviderConfig.mockResolvedValue(null)
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_API_KEY') {
        return 'sk-env-not-real'
      }
      if (key === 'AI_MODEL') {
        return 'env-model'
      }
      if (key === 'AI_PROTOCOL') {
        return 'openai'
      }
      if (key === 'AI_TIMEOUT_MS') {
        return 15_000
      }
      return undefined
    })
    const envSnapshot = await service.resolveRuntime()
    expect(envSnapshot?.source).toBe('env')
    expect(envSnapshot?.options.model).toBe('env-model')

    repository.findProviderConfig.mockResolvedValue(row({ status: 'disabled' }))
    await expect(service.resolveRuntime()).resolves.toBeNull()
  })

  it('数据库显式配置优先于环境变量', async () => {
    repository.findProviderConfig.mockResolvedValue(row())
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_PROVIDER_ENCRYPTION_KEY') {
        return ENCRYPTION_KEY
      }
      if (key === 'AI_API_KEY') {
        return 'sk-env-not-real'
      }
      if (key === 'AI_MODEL') {
        return 'env-model'
      }
      if (key === 'AI_TIMEOUT_MS') {
        return 15_000
      }
      return undefined
    })
    const snapshot = await service.resolveRuntime()
    expect(snapshot?.source).toBe('database')
    expect(snapshot?.options.apiKey).toBe('sk-stored-not-real')
    expect(snapshot?.options.model).toBe('gpt-test')
  })

  it('视图不返回完整密钥且配置变更后旧测试结果不再显示为成功', async () => {
    repository.findProviderConfig.mockResolvedValue(
      row({ version: 3, lastTestedVersion: 2, lastTestStatus: 'success' }),
    )
    const view = await service.getView()
    expect(view.hasApiKey).toBe(true)
    expect(view.apiKeyHint).toBe('••••real')
    expect(JSON.stringify(view)).not.toContain('sk-stored-not-real')
    expect(view.displayStatus).toBe('configured_unverified')
    expect(view.lastTestStatus).toBe('unverified')
  })

  it('留空密钥时保留原密文,更换密钥时写入新密文', async () => {
    const existing = row()
    repository.lockProviderConfigInTx.mockResolvedValue(existing)
    repository.updateProviderConfigInTx.mockImplementation(async (_tx, _version, patch) => ({
      ...existing,
      ...patch,
      version: existing.version + 1,
      updatedAt: new Date(),
    }))

    await service.update({
      expectedVersion: 2,
      protocol: 'openai',
      model: 'gpt-test',
      operationId: OP_SAVE,
      actor,
    })
    expect(repository.updateProviderConfigInTx.mock.calls[0][2].apiKeyCiphertext).toBe(
      existing.apiKeyCiphertext,
    )

    await service.update({
      expectedVersion: 2,
      protocol: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-replaced-not-real',
      operationId: OP_OTHER,
      actor,
    })
    const nextCipher = repository.updateProviderConfigInTx.mock.calls[1][2]
      .apiKeyCiphertext as string
    expect(nextCipher).not.toBe(existing.apiKeyCiphertext)
    expect(nextCipher).not.toContain('sk-replaced-not-real')
    const audit = repository.insertAuditLogInTx.mock.calls.at(-1)?.[1]
    expect(JSON.stringify(audit)).not.toContain('sk-replaced-not-real')
    expect(JSON.stringify(audit)).not.toContain(nextCipher)
  })

  it('版本冲突时抛出 409 且不覆盖', async () => {
    repository.lockProviderConfigInTx.mockResolvedValue(row({ version: 4 }))
    await expect(
      service.update({
        expectedVersion: 2,
        protocol: 'openai',
        model: 'gpt-test',
        operationId: OP_SAVE,
        actor,
      }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(repository.updateProviderConfigInTx).not.toHaveBeenCalled()
  })

  it('未配置视图版本为 0,过期的首次保存不会覆盖', async () => {
    repository.findProviderConfig.mockResolvedValue(null)
    const view = await service.getView()
    expect(view.version).toBe(0)
    repository.lockProviderConfigInTx.mockResolvedValue(null)
    await expect(
      service.update({
        expectedVersion: 1,
        protocol: 'openai',
        model: 'gpt-test',
        apiKey: 'sk-new-not-real',
        operationId: OP_SAVE,
        actor,
      }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(repository.insertProviderConfigInTx).not.toHaveBeenCalled()
  })

  it('缺少加密主密钥时拒绝写入新密钥', async () => {
    config.get.mockImplementation((key: string) => (key === 'NODE_ENV' ? 'production' : undefined))
    repository.lockProviderConfigInTx.mockResolvedValue(null)
    await expect(
      service.update({
        expectedVersion: 0,
        protocol: 'openai',
        model: 'gpt-test',
        apiKey: 'sk-new-not-real',
        operationId: OP_SAVE,
        actor,
      }),
    ).rejects.toMatchObject({ response: { code: 'AI_PROVIDER_ENCRYPTION_KEY_MISSING' } })
  })

  it('连接测试成功、鉴权失败与不安全地址分别返回对应结果,测试不等于保存', async () => {
    const saved = row()
    repository.findProviderConfig.mockResolvedValue(saved)
    repository.lockProviderConfigInTx.mockResolvedValue(saved)
    repository.updateProviderConfigInTx.mockResolvedValue({ ...saved, lastTestStatus: 'success' })
    const fetchOk = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const ok = await service.test({
      protocol: 'openai',
      model: 'gpt-test',
      actorUserId: actor.actorUserId,
      fetchImpl: fetchOk as unknown as typeof fetch,
    })
    expect(ok.ok).toBe(true)
    expect(ok.persisted).toBe(true)
    expect(repository.updateProviderConfigInTx.mock.calls[0][2].bumpVersion).toBe(false)

    const fetch401 = vi.fn().mockResolvedValue(new Response('no', { status: 401 }))
    const auth = await service.test({
      protocol: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-wrong-not-real',
      actorUserId: actor.actorUserId,
      fetchImpl: fetch401 as unknown as typeof fetch,
    })
    expect(auth.code).toBe('auth_failed')
    expect(auth.persisted).toBe(false)

    const unsafe = await service.test({
      protocol: 'openai',
      baseUrl: 'http://169.254.169.254/',
      model: 'gpt-test',
      apiKey: 'sk-not-real',
      actorUserId: actor.actorUserId,
    })
    expect(unsafe.code).toBe('unsafe_url')
  })

  it('仅更换 Key 且写入未成功时查询不到本次操作', async () => {
    repository.lockProviderConfigInTx.mockResolvedValue(row({ version: 3 }))
    await expect(
      service.update({
        expectedVersion: 2,
        protocol: 'openai',
        model: 'gpt-test',
        apiKey: 'sk-replaced-not-real',
        operationId: OP_SAVE,
        actor,
      }),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(repository.insertProviderOperationInTx).not.toHaveBeenCalled()
    repository.findProviderOperation.mockResolvedValue(null)
    await expect(service.getOperation(OP_SAVE)).resolves.toBeNull()
  })

  it('写入成功但响应丢失后仍可通过操作标识确认,被覆盖时标记非当前', async () => {
    const saved = row({ version: 3, lastOperationId: OP_SAVE, model: 'gpt-test' })
    repository.findProviderOperation.mockResolvedValue({
      operationId: OP_SAVE,
      kind: 'save',
      protocol: 'openai',
      baseUrl: saved.baseUrl,
      model: 'gpt-test',
      keyChanged: true,
      versionAfter: 3,
      createdAt: new Date('2026-09-18T00:00:00.000Z'),
    })
    repository.findProviderConfig.mockResolvedValue(saved)
    const current = await service.getOperation(OP_SAVE)
    expect(current?.isCurrent).toBe(true)
    expect(JSON.stringify(current)).not.toContain('sk-')
    repository.findProviderConfig.mockResolvedValue(
      row({ version: 4, lastOperationId: OP_OTHER, model: 'gpt-test' }),
    )
    const overwritten = await service.getOperation(OP_SAVE)
    expect(overwritten?.isCurrent).toBe(false)
    expect(overwritten?.versionAfter).toBe(3)
    expect(overwritten?.currentVersion).toBe(4)
  })

  it('同一操作标识重复提交不重复写入,不同内容复用则拒绝', async () => {
    const existingOp = {
      operationId: OP_SAVE,
      kind: 'save' as const,
      protocol: 'openai' as const,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-test',
      keyChanged: true,
      versionAfter: 3,
      createdAt: new Date(),
    }
    repository.findProviderOperationInTx.mockResolvedValue(existingOp)
    repository.lockProviderConfigInTx.mockResolvedValue(
      row({ version: 3, lastOperationId: OP_SAVE }),
    )
    await service.update({
      expectedVersion: 2,
      protocol: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-replaced-not-real',
      operationId: OP_SAVE,
      actor,
    })
    expect(repository.updateProviderConfigInTx).not.toHaveBeenCalled()
    expect(repository.insertProviderOperationInTx).not.toHaveBeenCalled()

    await expect(
      service.update({
        expectedVersion: 2,
        protocol: 'openai',
        model: 'other-model',
        apiKey: 'sk-replaced-not-real',
        operationId: OP_SAVE,
        actor,
      }),
    ).rejects.toMatchObject({ response: { code: 'AI_PROVIDER_OPERATION_CONFLICT' } })
  })

  it('连接测试超过限流时返回 429', async () => {
    redis.incrWithTtl.mockResolvedValue(6)
    await expect(
      service.test({
        protocol: 'openai',
        model: 'gpt-test',
        apiKey: 'sk-not-real',
        actorUserId: actor.actorUserId,
      }),
    ).rejects.toBeInstanceOf(HttpException)
  })
})
