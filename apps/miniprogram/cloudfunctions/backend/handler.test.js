import { describe, expect, it, vi } from 'vitest'
import { createBackendHandler } from './handler'
import { createRouter } from './router'
import { cleanupStaleStaged, isTimerEvent } from './handlers/uploads'
import { createInternalApiClient } from './api-client'
import { parseEnvelope, sanitizePayload } from './context'
import { BackendError } from './errors'

const ENVELOPE = {
  version: 1,
  operation: 'papers.list',
  requestId: 'req-1',
  payload: { status: 'inbox' },
}

const BASE_ENV = {
  INTERNAL_API_BASE_URL: 'https://api.example.com/api',
  INTERNAL_API_SIGNING_SECRET: 'secret-1',
}

const SESSION = {
  user: { id: 'user-1', nickname: '学习者' },
  tokens: {
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  },
}

function createFakeCloudDb(initialDocs = new Map()) {
  const docs = initialDocs
  const db = {
    command: {
      inc: (value) => ({ $inc: value }),
      lt: (value) => ({ $lt: value }),
    },
    serverDate: () => new Date(0),
    collection: () => ({
      doc(id) {
        return {
          async set({ data }) {
            docs.set(id, { ...data })
          },
          async get() {
            if (!docs.has(id)) {
              const error = new Error('document not exists')
              error.errMsg = 'document.get:fail document not exists'
              throw error
            }
            return { data: docs.get(id) }
          },
          async remove() {
            docs.delete(id)
          },
        }
      },
      where(condition) {
        const query = {
          limit() {
            return query
          },
          async get() {
            const threshold = condition.updatedAt?.$lt
            const matched = []
            for (const [id, doc] of docs) {
              if (
                !threshold ||
                (doc.updatedAt instanceof Date && doc.updatedAt.getTime() < threshold.getTime())
              ) {
                matched.push({ _id: id, ...doc })
              }
            }
            return { data: matched }
          },
        }
        return query
      },
    }),
  }
  const cloud = {
    database: () => db,
    downloadFile: async () => ({ fileContent: Buffer.from('jpeg-bytes') }),
    deleteFile: vi.fn(async () => undefined),
  }
  return { docs, db, cloud }
}

/** 组装处理器：微信上下文 / 内部 API / 云数据库 / 日志全部注入。 */
function setup(options = {}) {
  const internalCalls = []
  const logs = { info: [], error: [] }
  const apiClient = options.realSendRequest
    ? createInternalApiClient({
        env: { ...BASE_ENV, ...(options.env ?? {}) },
        sendRequest: options.realSendRequest,
        log: { info: (m) => logs.info.push(m), error: (m) => logs.error.push(m) },
      })
    : {
        isConfigured: () => true,
        exchangeIdentity: vi.fn(async ({ openId }) => {
          internalCalls.push({ kind: 'exchange', openId })
          if (options.exchangeRejects) {
            throw options.exchangeRejects
          }
          return options.exchange ?? SESSION
        }),
        forward: vi.fn(async ({ method, path, body, token, requestId, idempotencyKey }) => {
          internalCalls.push({
            kind: 'forward',
            method,
            path,
            body,
            token,
            requestId,
            idempotencyKey,
          })
          if (options.forwardImpl) {
            return options.forwardImpl({ method, path, body })
          }
          return options.forwardResponse ?? { ok: true }
        }),
        sendRaw: vi.fn(async (request) => {
          internalCalls.push({ kind: 'raw', url: request.url, method: request.method })
          return { status: 200, bodyText: '' }
        }),
      }
  const handler = createBackendHandler({
    getWXContext: () =>
      options.context !== undefined ? options.context : { OPENID: 'openid-1', APPID: 'app-1' },
    apiClient,
    cloud: options.cloud,
    env: { ...BASE_ENV, ...(options.env ?? {}) },
    log: { info: (m) => logs.info.push(m), error: (m) => logs.error.push(m) },
    ...(options.identityCache ? { identityCache: options.identityCache } : {}),
  })
  return { handler, internalCalls, logs }
}

describe('backend 云函数信封与路由', () => {
  it('合法信封解析出 operation、requestId 与幂等键', () => {
    const envelope = parseEnvelope({
      version: 1,
      operation: 'papers.create',
      requestId: 'req-9',
      idempotencyKey: 'idem-1',
      payload: { content: '内容' },
    })
    expect(envelope).toMatchObject({
      operation: 'papers.create',
      requestId: 'req-9',
      idempotencyKey: 'idem-1',
      payload: { content: '内容' },
    })
  })

  it('信封缺字段或版本不符时拒绝', () => {
    expect(() => parseEnvelope({ version: 2, operation: 'a', requestId: 'r' })).toThrow('版本')
    expect(() => parseEnvelope({ version: 1, requestId: 'r' })).toThrow('operation')
    expect(() => parseEnvelope({ version: 1, operation: 'a' })).toThrow('requestId')
  })

  it('剥离客户端伪造的身份字段', () => {
    const clean = sanitizePayload({
      userId: 'fake-user',
      openId: 'fake-openid',
      authorization: 'Bearer fake',
      content: '正文',
    })
    expect(clean).toEqual({ content: '正文' })
  })

  it('未知 operation 被白名单拒绝', async () => {
    const { handler } = setup()
    const result = await handler({ ...ENVELOPE, operation: 'system.exec' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('INVALID_INPUT')
  })

  it('路由表覆盖全部业务操作且为静态映射', () => {
    const router = createRouter()
    const names = router.operationNames()
    expect(names).toHaveLength(28)
    expect(names).toContain('papers.create')
    expect(names).toContain('auth.login')
    expect(names).toContain('uploads.attach')
    expect(router.resolve('system.exec')).toBeNull()
  })
})

describe('backend 云函数身份适配', () => {
  it('缺少 OPENID 时返回 UNAUTHENTICATED', async () => {
    const { handler, internalCalls } = setup({ context: {} })
    const result = await handler(ENVELOPE)
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } })
    expect(internalCalls).toHaveLength(0)
  })

  it('客户端伪造 userId 不影响身份解析，只使用 OPENID', async () => {
    const { handler, internalCalls } = setup({ forwardResponse: { items: [] } })
    const result = await handler({
      ...ENVELOPE,
      payload: { userId: 'someone-else', status: 'inbox' },
    })
    expect(result.ok).toBe(true)
    const exchange = internalCalls.find((entry) => entry.kind === 'exchange')
    expect(exchange.openId).toBe('openid-1')
    const forward = internalCalls.find((entry) => entry.kind === 'forward')
    expect(forward.path).toBe('/papers?status=inbox')
    // GET 请求参数只出现在查询串，不携带请求体。
    expect(forward.body).toBeUndefined()
  })

  it('账号未绑定时返回统一未认证错误', async () => {
    const { handler } = setup({
      exchangeRejects: new BackendError('ACCOUNT_NOT_LINKED', '账号未绑定'),
    })
    const result = await handler(ENVELOPE)
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } })
  })

  it('业务转发携带会话令牌并透传 requestId 与幂等键', async () => {
    const { handler, internalCalls } = setup({ forwardResponse: { id: 'p-1' } })
    const result = await handler({
      version: 1,
      operation: 'papers.create',
      requestId: 'req-7',
      idempotencyKey: 'idem-7',
      payload: { content: '内容' },
    })
    expect(result.ok).toBe(true)
    const forward = internalCalls.find((entry) => entry.kind === 'forward')
    expect(forward).toMatchObject({
      method: 'POST',
      path: '/papers',
      token: 'token-1',
      requestId: 'req-7',
      idempotencyKey: 'idem-7',
    })
  })

  it('刷新不触发身份交换且不携带令牌', async () => {
    const { handler, internalCalls } = setup({ forwardResponse: { accessToken: 'new-a' } })
    const result = await handler({
      version: 1,
      operation: 'auth.refresh',
      requestId: 'req-r1',
      payload: { refreshToken: 'refresh-old' },
    })
    expect(result.ok).toBe(true)
    expect(internalCalls.some((entry) => entry.kind === 'exchange')).toBe(false)
    const forward = internalCalls.find((entry) => entry.kind === 'forward')
    expect(forward).toMatchObject({
      path: '/auth/token/refresh',
      body: { refreshToken: 'refresh-old' },
      token: '',
    })
  })

  it('退出携带本地访问令牌撤销真实会话', async () => {
    const { handler, internalCalls } = setup({ forwardResponse: {} })
    const result = await handler({
      version: 1,
      operation: 'auth.logout',
      requestId: 'req-l1',
      payload: { accessToken: 'stale-access' },
    })
    expect(result.ok).toBe(true)
    expect(internalCalls.some((entry) => entry.kind === 'exchange')).toBe(false)
    const forward = internalCalls.find((entry) => entry.kind === 'forward')
    expect(forward).toMatchObject({ path: '/auth/logout', token: 'stale-access' })
  })

  it('退出缺少本地令牌时拒绝', async () => {
    const { handler, internalCalls } = setup({ forwardResponse: {} })
    const result = await handler({
      version: 1,
      operation: 'auth.logout',
      requestId: 'req-l2',
      payload: {},
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(internalCalls).toHaveLength(0)
  })

  it('身份交换结果按 OPENID 缓存复用', async () => {
    const identityCache = new Map()
    const { handler, internalCalls } = setup({ identityCache, forwardResponse: {} })
    await handler(ENVELOPE)
    await handler(ENVELOPE)
    const exchanges = internalCalls.filter((entry) => entry.kind === 'exchange')
    expect(exchanges).toHaveLength(1)
  })

  it('内部 API 未配置时返回功能关闭', async () => {
    const { handler } = setup({
      env: { INTERNAL_API_BASE_URL: '' },
      realSendRequest: async () => ({ status: 200, bodyText: '' }),
    })
    const result = await handler(ENVELOPE)
    expect(result).toMatchObject({ ok: false, error: { code: 'SERVICE_DISABLED' } })
  })

  it('删除箱子把 version 写入请求体', async () => {
    const { handler, internalCalls } = setup({ forwardResponse: { id: 't-1', version: 2 } })
    const result = await handler({
      version: 1,
      operation: 'topics.remove',
      requestId: 'req-td',
      payload: { id: 't-1', version: 2 },
    })
    expect(result.ok).toBe(true)
    const forward = internalCalls.find((entry) => entry.kind === 'forward')
    expect(forward).toMatchObject({
      method: 'DELETE',
      path: '/topics/t-1',
      body: { id: 't-1', version: 2 },
    })
  })

  it('真实内部客户端按 HMAC 签名发起身份交换', async () => {
    const sent = []
    const { handler } = setup({
      realSendRequest: async (request) => {
        sent.push(request)
        return {
          status: 200,
          bodyText: JSON.stringify({ data: SESSION }),
        }
      },
    })
    const result = await handler({
      version: 1,
      operation: 'auth.login',
      requestId: 'req-login',
      payload: { code: 'ignored' },
    })
    expect(result.ok).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0].method).toBe('POST')
    expect(sent[0].url).toBe('https://api.example.com/api/internal/auth/miniprogram/exchange')
    expect(sent[0].headers['x-request-id']).toBe('req-login')
    expect(sent[0].headers['x-internal-timestamp']).toEqual(expect.any(String))
    expect(sent[0].headers['x-internal-signature']).toEqual(expect.any(String))
    expect(JSON.parse(sent[0].body)).toEqual({ openId: 'openid-1' })
  })

  it('内部 API 账户停用映射为未认证错误', async () => {
    const { handler } = setup({
      realSendRequest: async () => ({
        status: 401,
        bodyText: JSON.stringify({
          error: { code: 'AUTH_ACCOUNT_DISABLED', message: '账户不可用' },
        }),
      }),
    })
    const result = await handler(ENVELOPE)
    expect(result).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } })
  })

  it('成功与失败日志只含 operation、requestId、耗时和错误码', async () => {
    const success = setup({ forwardResponse: {} })
    await success.handler(ENVELOPE)
    const failure = setup({
      env: { INTERNAL_API_BASE_URL: '' },
      realSendRequest: async () => ({ status: 200, bodyText: '' }),
    })
    await failure.handler(ENVELOPE)
    const serialized = JSON.stringify([...success.logs.info, ...failure.logs.error])
    expect(serialized).not.toContain('inbox')
    expect(serialized).not.toContain('openid-1')
    expect(serialized).not.toContain('token-1')
    expect(serialized).toContain('papers.list')
    expect(serialized).toContain('SERVICE_DISABLED')
  })
})

describe('backend 云函数能力开关', () => {
  it('服务端开关关闭 OCR 时能力返回 false', async () => {
    const { handler } = setup({ env: { OCR_ENABLED: 'false' } })
    const result = await handler({
      version: 1,
      operation: 'capabilities.get',
      requestId: 'req-cap',
      payload: {},
    })
    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({
      backendMode: 'cloud-function',
      ocrEnabled: false,
      maxCaptureImages: 9,
    })
  })
})

describe('backend 云函数上传适配', () => {
  it('暂存登记归属并返回私有 cloudPath', async () => {
    const { docs, cloud } = createFakeCloudDb()
    const { handler } = setup({ cloud })
    const result = await handler({
      version: 1,
      operation: 'uploads.stage',
      requestId: 'req-s1',
      payload: { uploadId: 'u-1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 1024 },
    })
    expect(result.ok).toBe(true)
    expect(result.data.cloudPath).toBe('staging/u-1.jpg')
    expect(docs.get('u-1')).toMatchObject({ owner: 'openid-1', kind: 'asset' })
  })

  it('文件超过上限时拒绝暂存', async () => {
    const { cloud } = createFakeCloudDb()
    const { handler } = setup({ cloud, env: { FILE_MAX_BYTES: '1024' } })
    const result = await handler({
      version: 1,
      operation: 'uploads.stage',
      requestId: 'req-s2',
      payload: { uploadId: 'u-1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 4096 },
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE' } })
  })

  it('同一 uploadId 不能被其他用户覆盖占用', async () => {
    const { docs, cloud } = createFakeCloudDb()
    docs.set('u-1', {
      owner: 'openid-someone-else',
      kind: 'asset',
      cloudPath: 'staging/u-1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
    })
    const { handler } = setup({ cloud })
    const result = await handler({
      version: 1,
      operation: 'uploads.stage',
      requestId: 'req-s3',
      payload: { uploadId: 'u-1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 1024 },
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(docs.get('u-1').owner).toBe('openid-someone-else')
  })

  it('绑定走归属校验、服务器侧直传与清理', async () => {
    const { docs, cloud } = createFakeCloudDb()
    docs.set('u-1', {
      owner: 'openid-1',
      kind: 'asset',
      cloudPath: 'staging/u-1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      sha256: 'abc',
    })
    const { handler, internalCalls } = setup({
      cloud,
      forwardImpl: ({ method, path }) => {
        if (method === 'POST' && path === '/uploads') {
          return {
            uploadId: 'u-1',
            assetId: 'asset-9',
            kind: 'image',
            status: 'pending',
            uploadUrl: 'https://storage.example.com/put',
            headers: { 'content-type': 'image/jpeg' },
            expiresAt: '2026-09-15T00:00:00.000Z',
          }
        }
        return { uploadId: 'u-1', assetId: 'asset-9', status: 'uploaded' }
      },
    })
    const result = await handler({
      version: 1,
      operation: 'uploads.attach',
      requestId: 'req-a1',
      payload: { uploadId: 'u-1', fileID: 'cloud://x/staging/u-1.jpg' },
    })
    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ uploadId: 'u-1', assetId: 'asset-9', status: 'attached' })
    // attach 属于身份操作：先交换身份，再携带用户令牌走预签名直传。
    expect(internalCalls.some((entry) => entry.kind === 'exchange')).toBe(true)
    const uploads = internalCalls.filter((entry) => entry.kind === 'forward')
    expect(uploads.map((entry) => entry.path)).toEqual(['/uploads', '/uploads/u-1/complete'])
    for (const entry of uploads) {
      expect(entry.token).toBe('token-1')
    }
    const raw = internalCalls.find((entry) => entry.kind === 'raw')
    expect(raw).toMatchObject({ method: 'PUT', url: 'https://storage.example.com/put' })
    expect(docs.has('u-1')).toBe(false)
    expect(cloud.deleteFile).toHaveBeenCalled()
  })

  it('无权绑定他人暂存文件时返回 FORBIDDEN', async () => {
    const { docs, cloud } = createFakeCloudDb()
    docs.set('u-other', {
      owner: 'openid-someone-else',
      kind: 'asset',
      cloudPath: 'staging/u-other.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
    })
    const { handler } = setup({
      cloud,
      context: { OPENID: 'openid-attacker' },
    })
    const result = await handler({
      version: 1,
      operation: 'uploads.attach',
      requestId: 'req-a2',
      payload: { uploadId: 'u-other', fileID: 'cloud://x/staging/u-other.jpg' },
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('OCR 临时文件登记与归属清理', async () => {
    const { docs, cloud } = createFakeCloudDb()
    const { handler } = setup({ cloud })
    const staged = await handler({
      version: 1,
      operation: 'uploads.stageTemp',
      requestId: 'req-t1',
      payload: { kind: 'ocr-temp' },
    })
    expect(staged.ok).toBe(true)
    expect(staged.data.cloudPath).toMatch(/^ocr-temp\//)
    expect(docs.get(staged.data.cloudPath)).toMatchObject({ owner: 'openid-1' })

    const cleaned = await handler({
      version: 1,
      operation: 'uploads.cleanupTemp',
      requestId: 'req-t2',
      payload: { fileRef: staged.data.cloudPath },
    })
    expect(cleaned.data).toEqual({ cleaned: true })
    expect(docs.has(staged.data.cloudPath)).toBe(false)

    const foreign = await handler({
      version: 1,
      operation: 'uploads.cleanupTemp',
      requestId: 'req-t3',
      payload: { fileRef: 'ocr-temp/unknown' },
    })
    expect(foreign.data).toEqual({ cleaned: false })
  })

  it('定时清理移除过期暂存登记与文件', async () => {
    const { docs, db } = createFakeCloudDb()
    docs.set('stale-1', {
      owner: 'openid-1',
      kind: 'asset',
      cloudPath: 'staging/stale-1.jpg',
      updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    })
    docs.set('fresh-1', {
      owner: 'openid-1',
      kind: 'asset',
      cloudPath: 'staging/fresh-1.jpg',
      updatedAt: new Date(),
    })
    const deleteFile = vi.fn(async () => undefined)
    const result = await cleanupStaleStaged(db, { deleteFile })
    expect(result).toEqual({ cleaned: 1 })
    expect(docs.has('stale-1')).toBe(false)
    expect(docs.has('fresh-1')).toBe(true)
    expect(deleteFile).toHaveBeenCalledWith({ fileList: ['staging/stale-1.jpg'] })
  })

  it('识别定时触发器事件', () => {
    expect(isTimerEvent({ Type: 'Timer', TriggerName: 'staged-files-cleanup' })).toBe(true)
    expect(isTimerEvent({ triggerName: 'x' })).toBe(true)
    expect(isTimerEvent({ version: 1, operation: 'papers.list', requestId: 'r' })).toBe(false)
  })
})
