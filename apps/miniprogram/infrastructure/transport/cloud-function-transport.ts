import {
  CLOUD_FUNCTION_REQUEST_VERSION,
  isCloudFunctionFailure,
  isCloudFunctionSuccess,
  serviceErrorFromCloudFailure,
  ServiceError,
  toServiceError,
  type CloudFunctionRequest,
} from '../../shared/service-runtime/index'
import type { MiniprogramTransport, TransportCallOptions } from './transport.types'

/** 默认统一入口云函数；OCR 等独立能力走各自适配器，不经此传输层。 */
export const BACKEND_CLOUD_FUNCTION_NAME = 'backend'

export type CloudCallFunctionResult = { result?: unknown }

export type CloudCallFunctionImpl = (options: {
  name: string
  data: CloudFunctionRequest
}) => Promise<CloudCallFunctionResult>

export interface CreateCloudFunctionTransportOptions {
  functionName?: string
  createRequestId: () => string
  /** 默认 wx.cloud.callFunction；测试注入。 */
  callFunction?: CloudCallFunctionImpl
  /** wx.cloud 能力探测；测试注入。 */
  cloudAvailable?: () => boolean
}

/**
 * CloudFunctionTransport：统一信封 + 响应结构校验 + 超时与取消。
 * 取消只放弃等待，云函数侧继续执行是平台限制，写操作幂等键保证安全。
 */
export function createCloudFunctionTransport(
  options: CreateCloudFunctionTransportOptions,
): MiniprogramTransport {
  const functionName = options.functionName ?? BACKEND_CLOUD_FUNCTION_NAME
  const callFunction =
    options.callFunction ??
    ((request: { name: string; data: CloudFunctionRequest }) =>
      wx.cloud.callFunction(request) as unknown as Promise<CloudCallFunctionResult>)
  const cloudAvailable =
    options.cloudAvailable ?? (() => typeof wx !== 'undefined' && Boolean(wx?.cloud))

  return {
    async call<TInput, TOutput>(
      operation: string,
      input: TInput,
      callOptions?: TransportCallOptions,
    ): Promise<TOutput> {
      if (!cloudAvailable()) {
        throw new ServiceError({
          code: 'SERVICE_DISABLED',
          message: '当前小程序未开通云能力',
          retryable: false,
        })
      }
      const envelope: CloudFunctionRequest = {
        version: CLOUD_FUNCTION_REQUEST_VERSION,
        operation,
        requestId: options.createRequestId(),
        ...(callOptions?.idempotencyKey ? { idempotencyKey: callOptions.idempotencyKey } : {}),
        payload: input ?? null,
      }
      let response: CloudCallFunctionResult
      try {
        response = await withTimeoutAndSignal(
          callFunction({ name: functionName, data: envelope }),
          callOptions,
        )
      } catch (error) {
        throw normalizeCallFailure(error)
      }
      const result = response?.result
      if (isCloudFunctionSuccess<TOutput>(result)) {
        return result.data
      }
      if (isCloudFunctionFailure(result)) {
        throw serviceErrorFromCloudFailure(result)
      }
      throw new ServiceError({
        code: 'UNKNOWN',
        message: '云函数响应结构非法',
        retryable: false,
        details: { requestId: envelope.requestId },
      })
    },
  }
}

function normalizeCallFailure(error: unknown): ServiceError {
  if (error instanceof ServiceError) {
    return error
  }
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message.includes('timeout') || message.includes('TIMED_OUT')) {
    return new ServiceError({ code: 'TIMEOUT', message: '云函数调用超时', retryable: true })
  }
  if (message.includes('取消') || message.includes('abort')) {
    return new ServiceError({ code: 'UNKNOWN', message: '请求已取消', retryable: false })
  }
  return toServiceError(error, { code: 'NETWORK_ERROR', message: '云函数调用失败' })
}

function withTimeoutAndSignal<T>(
  promise: Promise<T>,
  callOptions?: TransportCallOptions,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (callOptions?.signal && onAbort) {
      callOptions.signal.removeEventListener('abort', onAbort)
    }
  }
  const raced: Array<Promise<T>> = [promise]
  if (callOptions?.timeoutMs && callOptions.timeoutMs > 0) {
    raced.push(
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('云函数调用超时(timeout)')),
          callOptions.timeoutMs,
        )
      }),
    )
  }
  if (callOptions?.signal) {
    if (callOptions.signal.aborted) {
      return Promise.reject(new Error('请求已取消(abort)'))
    }
    raced.push(
      new Promise<T>((_, reject) => {
        onAbort = () => reject(new Error('请求已取消(abort)'))
        callOptions.signal!.addEventListener('abort', onAbort, { once: true })
      }),
    )
  }
  return Promise.race(raced).finally(cleanup)
}
