import { describe, expect, it } from 'vitest'
import {
  MAX_OCR_BASE64_LENGTH,
  fail,
  mergeOcrText,
  readCloudConfig,
  resolveCredential,
  resolveFailureCode,
  validateOcrInput,
  withTimeout,
} from './ocr-core'

describe('ocr-core 输入校验', () => {
  it('参数不完整时返回 OCR_INVALID_INPUT', () => {
    expect(validateOcrInput({ version: 1, imageBase64: 'QUJD' }).code).toBe('OCR_INVALID_INPUT')
    expect(validateOcrInput({ imageId: 'img-1', imageBase64: 'QUJD' }).code).toBe(
      'OCR_INVALID_INPUT',
    )
    expect(validateOcrInput({ imageId: 'img-1', version: 0, imageBase64: 'QUJD' }).code).toBe(
      'OCR_INVALID_INPUT',
    )
    expect(validateOcrInput({ imageId: 'img-1', version: 1.5, imageBase64: 'QUJD' }).code).toBe(
      'OCR_INVALID_INPUT',
    )
    expect(validateOcrInput({ imageId: 'img-1', version: 1 }).code).toBe('OCR_INVALID_INPUT')
    expect(validateOcrInput({ imageId: 'img-1', version: 1, imageBase64: '' }).code).toBe(
      'OCR_INVALID_INPUT',
    )
  })

  it('图片超过基础64上限时返回 OCR_IMAGE_TOO_LARGE', () => {
    const imageBase64 = 'A'.repeat(MAX_OCR_BASE64_LENGTH + 1)
    expect(validateOcrInput({ imageId: 'img-1', version: 1, imageBase64 }).code).toBe(
      'OCR_IMAGE_TOO_LARGE',
    )
  })

  it('图片内容不是合法 Base64 时返回 OCR_INVALID_INPUT', () => {
    expect(validateOcrInput({ imageId: 'img-1', version: 1, imageBase64: '不合法!!' }).code).toBe(
      'OCR_INVALID_INPUT',
    )
    expect(validateOcrInput({ imageId: 'img-1', version: 1, imageBase64: 'QUJ' }).code).toBe(
      'OCR_INVALID_INPUT',
    )
    expect(validateOcrInput({ imageId: 'img-1', version: 1, imageBase64: 'QUJD' })).toEqual({
      imageId: 'img-1',
      version: 1,
      imageBase64: 'QUJD',
    })
  })
})

describe('ocr-core 文本合并', () => {
  it('多段文字按 TextDetections 顺序合并并跳过空段', () => {
    const response = {
      TextDetections: [
        { DetectedText: '第一行' },
        {},
        { DetectedText: '' },
        { DetectedText: '第二行' },
      ],
    }
    expect(mergeOcrText(response)).toBe('第一行\n第二行')
  })

  it('响应缺少检测结果时合并为空文本', () => {
    expect(mergeOcrText({})).toBe('')
    expect(mergeOcrText(null)).toBe('')
    expect(mergeOcrText({ TextDetections: [] })).toBe('')
  })
})

describe('ocr-core 凭据与配置', () => {
  it('凭据解析优先长期密钥其次角色临时凭据', () => {
    expect(
      resolveCredential({
        TENCENT_SECRET_ID: 'static-id',
        TENCENT_SECRET_KEY: 'static-key',
        TENCENTCLOUD_SECRETID: 'role-id',
        TENCENTCLOUD_SECRETKEY: 'role-key',
        TENCENTCLOUD_SESSIONTOKEN: 'role-token',
      }),
    ).toEqual({ secretId: 'static-id', secretKey: 'static-key' })
    expect(
      resolveCredential({
        TENCENTCLOUD_SECRETID: 'role-id',
        TENCENTCLOUD_SECRETKEY: 'role-key',
        TENCENTCLOUD_SESSIONTOKEN: 'role-token',
      }),
    ).toEqual({ secretId: 'role-id', secretKey: 'role-key', token: 'role-token' })
    expect(resolveCredential({})).toBeNull()
  })

  it('配置读取支持默认值和显式覆盖', () => {
    expect(readCloudConfig({})).toEqual({
      enabled: false,
      dailyLimit: 50,
      timeoutMs: 12000,
      region: 'ap-guangzhou',
    })
    expect(
      readCloudConfig({
        OCR_ENABLED: 'true',
        OCR_DAILY_LIMIT: '30',
        OCR_TIMEOUT_MS: '8000',
        TENCENT_OCR_REGION: 'ap-shanghai',
      }),
    ).toEqual({ enabled: true, dailyLimit: 30, timeoutMs: 8000, region: 'ap-shanghai' })
  })
})

describe('ocr-core 失败与超时', () => {
  it('失败码只透出协议内错误', () => {
    expect(fail('OCR_RATE_LIMITED')).toEqual({ ok: false, code: 'OCR_RATE_LIMITED' })
    expect(resolveFailureCode(new Error('OCR_TIMEOUT'))).toBe('OCR_TIMEOUT')
    expect(resolveFailureCode(new Error('RequestId:xxx InnerError'))).toBe('OCR_PROVIDER_FAILED')
  })

  it('超时控制到点拒绝且不拦截正常结果', async () => {
    await expect(withTimeout(new Promise(() => undefined), 10)).rejects.toThrow('OCR_TIMEOUT')
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok')
  })
})
