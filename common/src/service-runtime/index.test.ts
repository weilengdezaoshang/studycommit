import { describe, expect, it } from 'vitest'
import {
  CLOUD_FUNCTION_REQUEST_VERSION,
  ServiceError,
  defaultClientCapabilities,
  isCloudFunctionFailure,
  isCloudFunctionSuccess,
  mergeClientCapabilities,
  serviceErrorCodeFromHttpStatus,
  serviceErrorFromCloudFailure,
  serviceErrorUserMessages,
  serviceUserMessage,
  toServiceError,
} from './index'

describe('ServiceError', () => {
  it('非运行层异常统一兜底并保留原始信息', () => {
    const wrapped = toServiceError(new Error('原始失败'), { code: 'NETWORK_ERROR' })
    expect(wrapped.code).toBe('NETWORK_ERROR')
    expect(wrapped.message).toBe('原始失败')
    expect(toServiceError(undefined, { code: 'UNKNOWN', message: '兜底文案' }).message).toBe(
      '兜底文案',
    )
    expect(toServiceError(wrapped).code).toBe('NETWORK_ERROR')
  })

  it('每个错误码都有稳定用户文案', () => {
    for (const code of Object.keys(serviceErrorUserMessages)) {
      const error = new ServiceError({ code: code as never, message: '', retryable: false })
      expect(serviceUserMessage(error)).not.toBe('')
    }
    expect(serviceUserMessage(new Error('任意错误'))).toBe(serviceErrorUserMessages.UNKNOWN)
  })
})

describe('云函数响应结构校验', () => {
  it('合法成功与失败信封分别通过校验', () => {
    expect(isCloudFunctionSuccess({ ok: true, requestId: 'req-1', data: { text: '' } })).toBe(true)
    expect(
      isCloudFunctionFailure({
        ok: false,
        requestId: 'req-1',
        error: { code: 'RATE_LIMITED', message: '受限', retryable: true },
      }),
    ).toBe(true)
  })

  it('缺失字段或异常类型判定为非法响应', () => {
    expect(isCloudFunctionSuccess({ ok: true, data: {} })).toBe(false)
    expect(isCloudFunctionSuccess({ ok: true, requestId: '', data: {} })).toBe(false)
    expect(isCloudFunctionFailure({ ok: false, requestId: 'req-1' })).toBe(false)
    expect(
      isCloudFunctionFailure({
        ok: false,
        requestId: 'req-1',
        error: { code: 'X', message: 'x' },
      }),
    ).toBe(false)
    expect(isCloudFunctionSuccess(null)).toBe(false)
    expect(isCloudFunctionFailure('oops')).toBe(false)
  })

  it('失败信封转换为统一错误且未知错误码归为 UNKNOWN', () => {
    const known = serviceErrorFromCloudFailure({
      ok: false,
      requestId: 'req-1',
      error: { code: 'RATE_LIMITED', message: '次数用完', retryable: true },
    })
    expect(known).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
    const unknown = serviceErrorFromCloudFailure({
      ok: false,
      requestId: 'req-1',
      error: { code: 'TENCENT_INNER_123', message: '内部堆栈', retryable: false },
    })
    expect(unknown.code).toBe('UNKNOWN')
    expect(unknown.message).not.toContain('堆栈')
  })
})

describe('HTTP 状态映射', () => {
  it('常见状态码映射为统一错误码', () => {
    expect(serviceErrorCodeFromHttpStatus(401)).toBe('UNAUTHENTICATED')
    expect(serviceErrorCodeFromHttpStatus(403)).toBe('FORBIDDEN')
    expect(serviceErrorCodeFromHttpStatus(404)).toBe('NOT_FOUND')
    expect(serviceErrorCodeFromHttpStatus(409)).toBe('CONFLICT')
    expect(serviceErrorCodeFromHttpStatus(413)).toBe('PAYLOAD_TOO_LARGE')
    expect(serviceErrorCodeFromHttpStatus(429)).toBe('RATE_LIMITED')
    expect(serviceErrorCodeFromHttpStatus(502)).toBe('PROVIDER_FAILED')
    expect(serviceErrorCodeFromHttpStatus(400)).toBe('UNKNOWN')
  })
})

describe('能力开关', () => {
  it('默认能力按传输模式给出 OCR 开关', () => {
    expect(defaultClientCapabilities('cloud-function')).toMatchObject({
      backendMode: 'cloud-function',
      ocrEnabled: true,
      maxCaptureImages: 9,
    })
    expect(defaultClientCapabilities('http').ocrEnabled).toBe(false)
  })

  it('服务端能力补丁只接受合法字段并具有最终决定权', () => {
    const merged = mergeClientCapabilities(defaultClientCapabilities('http'), {
      backendMode: 'cloud-function',
      captureEnabled: false,
      ocrEnabled: true,
      maxCaptureImages: 99,
      maxImageBytes: 1024,
      anythingElse: 'ignored',
    })
    expect(merged).toEqual({
      backendMode: 'cloud-function',
      captureEnabled: false,
      imageRecordEnabled: true,
      ocrEnabled: true,
      maxCaptureImages: 9,
      maxImageBytes: 1024,
    })
    expect(
      mergeClientCapabilities(defaultClientCapabilities('http'), { backendMode: 'weird' })
        .backendMode,
    ).toBe('http')
    expect(mergeClientCapabilities(defaultClientCapabilities('http'), null).maxCaptureImages).toBe(
      CLOUD_FUNCTION_REQUEST_VERSION >= 1 ? 9 : 9,
    )
  })
})
