import { describe, expect, it, vi } from 'vitest'
import { ServiceError } from '../../shared/service-runtime/index'
import { createUploadsService } from './uploads-service'
import type { MiniprogramTransport } from '../transport/transport.types'

const BYTES = new TextEncoder().encode('fake-image-bytes')

function createFakeTransport(handlers: Record<string, (input: never) => unknown>) {
  const calls: Array<{ operation: string; input: unknown }> = []
  const transport: MiniprogramTransport = {
    call: vi.fn(async (operation: string, input: never) => {
      calls.push({ operation, input })
      const handler = handlers[operation]
      if (!handler) {
        throw new Error(`未配置操作 ${operation}`)
      }
      return handler(input) as never
    }),
  }
  return { calls, transport }
}

const platform = {
  readFileBytes: vi.fn(async () => BYTES.slice(0).buffer as ArrayBuffer),
  putToUrl: vi.fn(async () => undefined),
  uploadCloudFile: vi.fn(async () => 'fileID-u-1'),
}

describe('uploads-service HTTP 预签名直传', () => {
  it('稳定 uploadId 贯穿创建与完成', async () => {
    const { calls, transport } = createFakeTransport({
      'uploads.create': () => ({
        uploadId: '11111111-1111-4111-8111-111111111111',
        assetId: '22222222-2222-4222-8222-222222222222',
        kind: 'image',
        status: 'pending',
        uploadUrl: 'https://storage.example.com/upload',
        headers: { 'content-type': 'image/jpeg' },
        expiresAt: '2026-09-15T00:00:00.000Z',
      }),
      'uploads.complete': () => ({
        uploadId: '11111111-1111-4111-8111-111111111111',
        assetId: '22222222-2222-4222-8222-222222222222',
        kind: 'image',
        status: 'uploaded',
        mimeType: 'image/jpeg',
        sizeBytes: BYTES.byteLength,
        width: 100,
        height: 80,
      }),
    })
    const service = createUploadsService({ transport, mode: 'http', ...platform })
    const outcome = await service.upload({
      path: 'file://a.jpg',
      uploadId: 'u-1',
      mimeType: 'image/jpeg',
    })
    expect(outcome).toEqual({ uploadId: 'u-1', status: 'uploaded' })
    expect(calls.map((call) => call.operation)).toEqual(['uploads.create', 'uploads.complete'])
    expect(calls[0].input).toMatchObject({ uploadId: 'u-1', sizeBytes: BYTES.byteLength })
    expect(platform.putToUrl).toHaveBeenCalledWith(
      'https://storage.example.com/upload',
      { 'content-type': 'image/jpeg' },
      expect.any(ArrayBuffer),
    )
  })

  it('重启后重试复用同一 uploadId（服务端幂等去重）', async () => {
    const { calls, transport } = createFakeTransport({
      'uploads.create': () => ({
        uploadId: '11111111-1111-4111-8111-111111111111',
        assetId: '22222222-2222-4222-8222-222222222222',
        kind: 'image',
        status: 'pending',
        uploadUrl: 'https://storage.example.com/upload',
        headers: {},
        expiresAt: '2026-09-15T00:00:00.000Z',
      }),
      'uploads.complete': () => ({
        uploadId: '11111111-1111-4111-8111-111111111111',
        assetId: '22222222-2222-4222-8222-222222222222',
        kind: 'image',
        status: 'uploaded',
        mimeType: 'image/jpeg',
        sizeBytes: BYTES.byteLength,
        width: 100,
        height: 80,
      }),
    })
    const service = createUploadsService({ transport, mode: 'http', ...platform })
    await service.upload({ path: 'file://a.jpg', uploadId: 'u-1', mimeType: 'image/jpeg' })
    await service.upload({ path: 'file://a.jpg', uploadId: 'u-1', mimeType: 'image/jpeg' })
    expect(calls.filter((call) => call.operation === 'uploads.create')).toHaveLength(2)
    expect(calls[1].input).toMatchObject({ uploadId: 'u-1' })
  })

  it('直传失败时中止且不调用完成', async () => {
    const { calls, transport } = createFakeTransport({
      'uploads.create': () => ({
        uploadId: '11111111-1111-4111-8111-111111111111',
        assetId: '22222222-2222-4222-8222-222222222222',
        kind: 'image',
        status: 'pending',
        uploadUrl: 'https://storage.example.com/upload',
        headers: {},
        expiresAt: '2026-09-15T00:00:00.000Z',
      }),
      'uploads.complete': () => ({}),
    })
    const service = createUploadsService({
      transport,
      mode: 'http',
      readFileBytes: platform.readFileBytes,
      putToUrl: vi.fn(async () => {
        throw new ServiceError({ code: 'PROVIDER_FAILED', message: '直传失败', retryable: true })
      }),
    })
    await expect(
      service.upload({ path: 'file://a.jpg', uploadId: 'u-1', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_FAILED' })
    expect(calls.map((call) => call.operation)).toEqual(['uploads.create'])
  })

  it('文件超过上限时本地拒绝且不发起会话', async () => {
    const { calls, transport } = createFakeTransport({})
    const service = createUploadsService({
      transport,
      mode: 'http',
      readFileBytes: vi.fn(async () => new ArrayBuffer(2048)),
      getMaxImageBytes: () => 1024,
    })
    await expect(
      service.upload({ path: 'file://big.jpg', uploadId: 'u-1', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
    expect(calls).toHaveLength(0)
  })
})

describe('uploads-service 云存储链路', () => {
  it('暂存后由云函数绑定附件并返回 attached', async () => {
    const { calls, transport } = createFakeTransport({
      'uploads.stage': () => ({ cloudPath: 'staging/u-1.jpg' }),
      'uploads.attach': () => ({ uploadId: 'u-1', assetId: 'a-1', status: 'attached' }),
    })
    const service = createUploadsService({ transport, mode: 'cloud-function', ...platform })
    const outcome = await service.upload({
      path: 'file://a.jpg',
      uploadId: 'u-1',
      mimeType: 'image/jpeg',
    })
    expect(outcome).toEqual({ uploadId: 'u-1', assetId: 'a-1', status: 'attached' })
    expect(calls.map((call) => call.operation)).toEqual(['uploads.stage', 'uploads.attach'])
    expect(platform.uploadCloudFile).toHaveBeenCalledWith('staging/u-1.jpg', 'file://a.jpg')
    expect(calls[1].input).toMatchObject({ uploadId: 'u-1', fileID: 'fileID-u-1' })
  })

  it('绑定响应异常时报供应商失败便于重试', async () => {
    const { transport } = createFakeTransport({
      'uploads.stage': () => ({ cloudPath: 'staging/u-1.jpg' }),
      'uploads.attach': () => ({ status: 'pending' }),
    })
    const service = createUploadsService({ transport, mode: 'cloud-function', ...platform })
    await expect(
      service.upload({ path: 'file://a.jpg', uploadId: 'u-1', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_FAILED', retryable: true })
  })
})
