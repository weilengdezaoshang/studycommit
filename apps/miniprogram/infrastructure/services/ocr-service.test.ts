import { describe, expect, it, vi } from 'vitest'
import { createOcrService } from './ocr-service'
import { createCapabilitiesService } from './capabilities-service'
import type { MiniprogramTransport } from '../transport/transport.types'

function createTransport(handlers: Record<string, (input: never) => unknown>) {
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

describe('capabilities-service', () => {
  it('HTTP 模式使用本地默认能力', async () => {
    const { transport } = createTransport({})
    const service = createCapabilitiesService({ mode: 'http', transport })
    expect(service.get()).toMatchObject({
      backendMode: 'http',
      ocrEnabled: false,
      maxCaptureImages: 9,
    })
    await service.refresh()
    expect(service.get().backendMode).toBe('http')
  })

  it('云函数模式刷新后服务端开关具有最终决定权', async () => {
    const storage = new Map<string, unknown>()
    const { transport } = createTransport({
      'capabilities.get': () => ({
        captureEnabled: false,
        ocrEnabled: true,
        maxCaptureImages: 5,
        backendMode: 'http',
      }),
    })
    const service = createCapabilitiesService({
      mode: 'cloud-function',
      transport,
      storage: {
        get: (key) => storage.get(key),
        set: (key, value) => storage.set(key, value),
      },
    })
    await service.refresh()
    // backendMode 不随服务端补丁切换（避免与当前传输不一致），其余字段以服务端为准。
    expect(service.get()).toMatchObject({
      backendMode: 'cloud-function',
      captureEnabled: false,
      ocrEnabled: true,
      maxCaptureImages: 5,
    })
    expect(storage.size).toBe(1)
  })

  it('首次拉取失败时保持采集入口关闭', async () => {
    const { transport } = createTransport({})
    const service = createCapabilitiesService({ mode: 'cloud-function', transport })
    await service.refresh()
    expect(service.get().captureEnabled).toBe(false)
  })
})

describe('ocr-service 统一识别适配器', () => {
  function createOcr(
    handlers: Record<string, (input: never) => unknown>,
    overrides: Partial<Parameters<typeof createOcrService>[0]> = {},
  ) {
    const { transport } = createTransport(handlers)
    const callFunction = vi.fn(async () => ({
      result: { ok: true, imageId: 'img-1', version: 1, text: '  正文 ' },
    }))
    const uploadCloudFile = vi.fn(async () => 'fileID-1')
    const service = createOcrService({
      mode: 'cloud-function',
      transport,
      callFunction,
      uploadCloudFile,
      cloudAvailable: () => true,
      ...overrides,
    })
    return { service, callFunction, uploadCloudFile }
  }

  it('fileRef 识别成功并返回公共结果', async () => {
    const { service, callFunction } = createOcr({})
    await expect(
      service.recognize({ imageId: 'img-1', version: 1, fileRef: 'ocr-temp/t1' }),
    ).resolves.toEqual({ imageId: 'img-1', version: 1, text: '正文' })
    expect(callFunction).toHaveBeenCalledWith({
      name: 'ocr',
      data: { imageId: 'img-1', version: 1, fileRef: 'ocr-temp/t1' },
    })
  })

  it('本地路径先登记暂存位并上传私有云文件', async () => {
    const { service, callFunction, uploadCloudFile } = createOcr({
      'uploads.stageTemp': () => ({ cloudPath: 'ocr-temp/t-1' }),
    })
    await service.recognize({ imageId: 'img-1', version: 1, localPath: 'file://a.jpg' })
    expect(uploadCloudFile).toHaveBeenCalledWith('ocr-temp/t-1', 'file://a.jpg')
    expect(callFunction).toHaveBeenCalledWith({
      name: 'ocr',
      data: { imageId: 'img-1', version: 1, fileRef: 'ocr-temp/t-1' },
    })
  })

  it('识别失败时清理临时识别资源', async () => {
    const { transport } = createTransport({
      'uploads.stageTemp': () => ({ cloudPath: 'ocr-temp/t-1' }),
      'uploads.cleanupTemp': () => ({}),
    })
    const callFunction = vi.fn(async () => ({
      result: { ok: false, code: 'OCR_TIMEOUT' },
    }))
    const service = createOcrService({
      mode: 'cloud-function',
      transport,
      callFunction,
      uploadCloudFile: vi.fn(async () => 'fileID-1'),
      cloudAvailable: () => true,
    })
    await expect(
      service.recognize({ imageId: 'img-1', version: 1, localPath: 'file://a.jpg' }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(transport.call).toHaveBeenCalledWith('uploads.cleanupTemp', {
      fileRef: 'ocr-temp/t-1',
    })
  })

  it('OCR 业务失败码映射为统一 ServiceError', async () => {
    const { transport } = createTransport({})
    const callFunction = vi.fn(async () => ({
      result: { ok: false, code: 'OCR_RATE_LIMITED' },
    }))
    const service = createOcrService({
      mode: 'cloud-function',
      transport,
      callFunction,
      cloudAvailable: () => true,
    })
    await expect(
      service.recognize({ imageId: 'img-1', version: 1, fileRef: 'ocr-temp/t1' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('HTTP 模式明确报功能关闭', async () => {
    const { transport } = createTransport({})
    const service = createOcrService({ mode: 'http', transport })
    await expect(
      service.recognize({ imageId: 'img-1', version: 1, localPath: 'file://a.jpg' }),
    ).rejects.toMatchObject({ code: 'SERVICE_DISABLED' })
  })

  it('缺少图片输入时拒绝', async () => {
    const { transport } = createTransport({})
    const service = createOcrService({
      mode: 'cloud-function',
      transport,
      cloudAvailable: () => true,
    })
    await expect(service.recognize({ imageId: 'img-1', version: 1 })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })
})
