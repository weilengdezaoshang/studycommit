import { describe, expect, it, vi } from 'vitest'
import { createOcrHandler } from './handler'

const BASE_ENV = {
  OCR_ENABLED: 'true',
  OCR_DAILY_LIMIT: '50',
  OCR_TIMEOUT_MS: '1000',
  TENCENT_SECRET_ID: 'secret-id',
  TENCENT_SECRET_KEY: 'secret-key',
}
const VALID_EVENT = { imageId: 'img-1', version: 2, imageBase64: 'QUJD' }
const today = () => new Date().toISOString().slice(0, 10)

/** 模拟云数据库：条件更新按文档当前值原子判定，add 拒绝重复 _id。 */
function createFakeDb() {
  const docs = new Map()
  return {
    docs,
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
        return {
          // wx-server-sdk 的 update 入参形如 { data: {...} }，这里按同样契约解包。
          async update(patch) {
            const doc = docs.get(condition._id)
            if (!doc || doc.count >= condition.count.$lt) {
              return { stats: { updated: 0 } }
            }
            doc.count += patch.data.count.$inc
            return { stats: { updated: 1 } }
          },
        }
      },
      async add({ data }) {
        if (docs.has(data._id)) {
          throw new Error('document already exists')
        }
        docs.set(data._id, { ...data })
        return { _id: data._id }
      },
    }),
  }
}

function setup(options = {}) {
  const db = options.db ?? createFakeDb()
  const providerCalls = []
  const logs = { info: [], error: [] }
  const handler = createOcrHandler({
    getWXContext: () => (options.context !== undefined ? options.context : { OPENID: 'openid-1' }),
    db,
    env: { ...BASE_ENV, ...(options.env ?? {}) },
    downloadFile: options.downloadFile,
    deleteFile: options.deleteFile,
    createOcrClient: (credential, region, timeoutSeconds) => ({
      GeneralAccurateOCR: (params) => {
        providerCalls.push({ credential, region, timeoutSeconds, params })
        const response =
          options.response !== undefined
            ? options.response
            : { TextDetections: [{ DetectedText: '第一行' }, { DetectedText: '第二行' }] }
        return options.rejectProvider
          ? Promise.reject(options.rejectProvider)
          : Promise.resolve(response)
      },
    }),
    log: {
      info: (message) => logs.info.push(message),
      error: (message) => logs.error.push(message),
    },
  })
  return { handler, db, providerCalls, logs }
}

describe('ocr 云函数处理器', () => {
  it('缺少微信身份时拒绝识别且不调用腾讯云', async () => {
    const { handler, providerCalls } = setup({ context: {} })
    expect(await handler(VALID_EVENT)).toEqual({ ok: false, code: 'OCR_UNAUTHENTICATED' })
    expect(providerCalls).toHaveLength(0)
  })

  it('OCR 功能关闭时返回 OCR_DISABLED', async () => {
    const disabled = setup({ env: { OCR_ENABLED: 'false' } })
    expect(await disabled.handler(VALID_EVENT)).toEqual({ ok: false, code: 'OCR_DISABLED' })
    const unset = setup({ env: { OCR_ENABLED: '' } })
    expect(await unset.handler(VALID_EVENT)).toEqual({ ok: false, code: 'OCR_DISABLED' })
    expect(disabled.providerCalls).toHaveLength(0)
    expect(unset.providerCalls).toHaveLength(0)
  })

  it('参数不完整时返回 OCR_INVALID_INPUT 且不调用腾讯云', async () => {
    const { handler, providerCalls } = setup()
    expect(await handler({ version: 1, imageBase64: 'QUJD' })).toEqual({
      ok: false,
      code: 'OCR_INVALID_INPUT',
    })
    expect(await handler({ imageId: 'img-1', version: 0, imageBase64: 'QUJD' })).toEqual({
      ok: false,
      code: 'OCR_INVALID_INPUT',
    })
    expect(await handler({ imageId: 'img-1', version: 1 })).toEqual({
      ok: false,
      code: 'OCR_INVALID_INPUT',
    })
    expect(providerCalls).toHaveLength(0)
  })

  it('图片超过基础64上限时返回 OCR_IMAGE_TOO_LARGE 且不调用腾讯云', async () => {
    const { handler, providerCalls } = setup()
    const event = { imageId: 'img-1', version: 1, imageBase64: 'A'.repeat(4 * 1024 * 1024 + 1) }
    expect(await handler(event)).toEqual({ ok: false, code: 'OCR_IMAGE_TOO_LARGE' })
    expect(providerCalls).toHaveLength(0)
  })

  it('凭据与开关之外缺密钥时返回 OCR_NOT_CONFIGURED', async () => {
    const { handler, providerCalls } = setup({
      env: { TENCENT_SECRET_ID: '', TENCENT_SECRET_KEY: '' },
    })
    expect(await handler(VALID_EVENT)).toEqual({ ok: false, code: 'OCR_NOT_CONFIGURED' })
    expect(providerCalls).toHaveLength(0)
  })

  it('每日调用次数超限时返回 OCR_RATE_LIMITED 且不再调用腾讯云', async () => {
    const { handler, db, providerCalls } = setup()
    db.docs.set(`openid-1_${today()}`, { count: 50 })
    expect(await handler(VALID_EVENT)).toEqual({ ok: false, code: 'OCR_RATE_LIMITED' })
    expect(providerCalls).toHaveLength(0)
  })

  it('并发调用不会绕过每日限额', async () => {
    const { handler, db, providerCalls } = setup({ env: { OCR_DAILY_LIMIT: '2' } })
    const results = await Promise.all([
      handler(VALID_EVENT),
      handler(VALID_EVENT),
      handler(VALID_EVENT),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(2)
    expect(results.filter((result) => result.code === 'OCR_RATE_LIMITED')).toHaveLength(1)
    expect(providerCalls).toHaveLength(2)
    expect(db.docs.get(`openid-1_${today()}`).count).toBe(2)
  })

  it('当日首次调用创建计数并占用一次配额', async () => {
    const { handler, db, providerCalls } = setup({ env: { OCR_DAILY_LIMIT: '1' } })
    expect((await handler(VALID_EVENT)).ok).toBe(true)
    expect((await handler(VALID_EVENT)).code).toBe('OCR_RATE_LIMITED')
    expect(providerCalls).toHaveLength(1)
    expect(db.docs.get(`openid-1_${today()}`).count).toBe(1)
  })

  it('腾讯云调用超时时返回 OCR_TIMEOUT', async () => {
    const { handler, providerCalls } = setup({
      env: { OCR_TIMEOUT_MS: '20' },
      response: new Promise(() => undefined),
    })
    expect(await handler(VALID_EVENT)).toEqual({ ok: false, code: 'OCR_TIMEOUT' })
    // SDK 自身超时比协议超时多 1 秒，超时统一由处理器判定。
    expect(providerCalls[0].timeoutSeconds).toBe(2)
  })

  it('腾讯云调用失败时返回 OCR_PROVIDER_FAILED 且不透出原始异常', async () => {
    const { handler } = setup({ rejectProvider: new Error('RequestId:xyz 内部签名错误') })
    const result = await handler(VALID_EVENT)
    expect(result).toEqual({ ok: false, code: 'OCR_PROVIDER_FAILED' })
    expect(Object.keys(result).sort()).toEqual(['code', 'ok'])
  })

  it('无文字时返回有效空结果', async () => {
    const { handler } = setup({ response: { TextDetections: [] } })
    expect(await handler(VALID_EVENT)).toEqual({
      ok: true,
      imageId: 'img-1',
      version: 2,
      text: '',
    })
  })

  it('多段文字按 TextDetections 顺序合并', async () => {
    const { handler } = setup()
    expect(await handler(VALID_EVENT)).toEqual({
      ok: true,
      imageId: 'img-1',
      version: 2,
      text: '第一行\n第二行',
    })
  })

  it('成功时按配置调用腾讯云并回显图片身份', async () => {
    const { handler, providerCalls } = setup()
    const result = await handler(VALID_EVENT)
    expect(result.ok).toBe(true)
    expect(result.imageId).toBe('img-1')
    expect(result.version).toBe(2)
    expect(providerCalls[0]).toMatchObject({
      region: 'ap-guangzhou',
      timeoutSeconds: 2,
      params: { ImageBase64: 'QUJD' },
    })
    expect(providerCalls[0].credential).toEqual({ secretId: 'secret-id', secretKey: 'secret-key' })
  })

  it('未配置长期密钥时使用平台注入的角色临时凭据', async () => {
    const { handler, providerCalls } = setup({
      env: {
        TENCENT_SECRET_ID: '',
        TENCENT_SECRET_KEY: '',
        TENCENTCLOUD_SECRETID: 'role-id',
        TENCENTCLOUD_SECRETKEY: 'role-key',
        TENCENTCLOUD_SESSIONTOKEN: 'role-token',
      },
    })
    expect((await handler(VALID_EVENT)).ok).toBe(true)
    expect(providerCalls[0].credential).toEqual({
      secretId: 'role-id',
      secretKey: 'role-key',
      token: 'role-token',
    })
  })

  it('私有临时文件归属匹配时下载并识别', async () => {
    const db = createFakeDb()
    db.docs.set('ocr-temp/t-1', {
      owner: 'openid-1',
      kind: 'ocr-temp',
      cloudPath: 'ocr-temp/t-1',
      fileID: 'cloud://x/ocr-temp/t-1',
    })
    const { handler, providerCalls } = setup({
      db,
      downloadFile: async ({ fileID }) => ({
        fileContent: Buffer.from('dGVzdA==', 'base64'),
        fileID,
      }),
    })
    const result = await handler({ imageId: 'img-1', version: 1, fileRef: 'ocr-temp/t-1' })
    expect(result.ok).toBe(true)
    expect(providerCalls[0].params.ImageBase64).toBe(
      Buffer.from('dGVzdA==', 'base64').toString('base64'),
    )
  })

  it('无权识别其他用户暂存文件时返回 FORBIDDEN', async () => {
    const db = createFakeDb()
    db.docs.set('ocr-temp/t-2', { owner: 'openid-someone-else', kind: 'ocr-temp', cloudPath: 'x' })
    const { handler } = setup({
      db,
      downloadFile: async () => ({ fileContent: Buffer.from('x') }),
    })
    const result = await handler({ imageId: 'img-1', version: 1, fileRef: 'ocr-temp/t-2' })
    expect(result).toEqual({ ok: false, code: 'OCR_FORBIDDEN' })
    expect(db.docs.has('ocr-temp/t-2')).toBe(true)
  })

  it('识别结束后清理临时识别资源', async () => {
    const db = createFakeDb()
    db.docs.set('ocr-temp/t-3', {
      owner: 'openid-1',
      kind: 'ocr-temp',
      cloudPath: 'ocr-temp/t-3',
      fileID: 'cloud://x/ocr-temp/t-3',
    })
    const deleteFile = vi.fn(async () => undefined)
    const { handler } = setup({
      db,
      deleteFile,
      downloadFile: async () => ({ fileContent: Buffer.from('x') }),
    })
    const result = await handler({ imageId: 'img-1', version: 1, fileRef: 'ocr-temp/t-3' })
    expect(result.ok).toBe(true)
    expect(db.docs.has('ocr-temp/t-3')).toBe(false)
    expect(deleteFile).toHaveBeenCalledWith({ fileList: ['cloud://x/ocr-temp/t-3'] })
  })

  it('日志只记录图片身份、版本、耗时和错误码', async () => {
    const success = setup()
    await success.handler(VALID_EVENT)
    const failure = setup({ rejectProvider: new Error('boom-internal-request-id') })
    await failure.handler(VALID_EVENT)
    const serialized = JSON.stringify([
      ...success.logs.info,
      ...success.logs.error,
      ...failure.logs.info,
      ...failure.logs.error,
    ])
    expect(serialized).not.toContain('QUJD')
    expect(serialized).not.toContain('第一行')
    expect(serialized).not.toContain('openid-1')
    expect(serialized).not.toContain('secret-id')
    expect(serialized).not.toContain('secret-key')
    expect(serialized).not.toContain('boom-internal-request-id')
    expect(serialized).toContain('img-1')
    expect(serialized).toContain('ocr_complete')
    expect(serialized).toContain('OCR_PROVIDER_FAILED')
    for (const line of success.logs.info) {
      expect(Object.keys(JSON.parse(line)).sort()).toEqual([
        'durationMs',
        'event',
        'imageId',
        'version',
      ])
    }
    for (const line of failure.logs.error) {
      expect(Object.keys(JSON.parse(line)).sort()).toEqual([
        'code',
        'durationMs',
        'event',
        'imageId',
        'version',
      ])
    }
  })
})
