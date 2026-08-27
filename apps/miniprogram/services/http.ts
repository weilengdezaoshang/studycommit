import {
  createApiUrl,
  createHttpError,
  httpErrorFromStatus,
  HttpError,
  redactSensitive,
} from '@studycommit/common/http'
import type { Monitor } from '@studycommit/observability'
import { monitor as defaultMonitor } from './monitor-adapter'

export type MiniProgramResponse = {
  statusCode: number
  data: unknown
  header: Record<string, unknown>
}

export type MiniProgramFailure = {
  errMsg?: string
  errCode?: number
}

export type MiniProgramRequestTask = {
  abort(): void
}

export type MiniProgramRequestOption = {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
  dataType: 'json'
  header: Record<string, string>
  timeout: number
  success?: (response: MiniProgramResponse) => void
  fail?: (error: MiniProgramFailure) => void
}

export type MiniProgramRequest = (options: MiniProgramRequestOption) => MiniProgramRequestTask

export type MiniProgramHttpRequest<TResponse> = {
  method?: MiniProgramRequestOption['method']
  path: string
  data?: unknown
  headers?: Readonly<Record<string, string>>
  timeoutMs?: number
  signal?: AbortSignal
  parse?: (data: unknown) => TResponse
}

export type MiniProgramHttpClientOptions = {
  baseUrl: string
  apiPrefix?: string
  defaultTimeoutMs?: number
  allowInsecureHttp?: boolean
  getToken?: () => string | undefined
  createRequestId?: () => string
  requestImpl?: MiniProgramRequest
  monitor?: Pick<Monitor, 'captureError'>
}

export type MiniProgramRequestPromise<TResponse> = Promise<TResponse> & {
  cancel(): void
}

const DEFAULT_API_PREFIX = '/api'
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 120_000
const REQUEST_ACTION = 'http_request'

export function createMiniProgramHttpClient(options: MiniProgramHttpClientOptions) {
  const requestImpl = options.requestImpl ?? defaultRequest
  const monitor = options.monitor ?? defaultMonitor
  const createRequestId = options.createRequestId ?? defaultRequestId

  return {
    request<TResponse>(
      request: MiniProgramHttpRequest<TResponse>,
    ): MiniProgramRequestPromise<TResponse> {
      const requestId = createRequestId()
      const method = request.method ?? 'GET'
      let task: MiniProgramRequestTask | undefined
      let settled = false
      let removeSignalListener: () => void = () => undefined
      let rejectRequest: (error: unknown) => void = () => undefined

      const promise = new Promise<TResponse>((resolve, reject) => {
        rejectRequest = (error) => {
          if (settled) {
            return
          }
          settled = true
          removeSignalListener()
          const httpError = error instanceof HttpError ? error : mapRequestFailure(error, requestId)
          reportRequestError(monitor, httpError, { method, path: request.path, requestId })
          reject(httpError)
        }

        const resolveRequest = (response: MiniProgramResponse) => {
          if (settled) {
            return
          }
          try {
            const result = parseResponse(response, request, requestId)
            settled = true
            removeSignalListener()
            resolve(result)
          } catch (error) {
            rejectRequest(error)
          }
        }

        try {
          if (request.signal?.aborted) {
            rejectRequest(createHttpError({ code: 'CANCELLED', message: '请求已取消', requestId }))
            return
          }

          const url = createApiUrl({
            origin: options.baseUrl,
            apiPrefix: options.apiPrefix ?? DEFAULT_API_PREFIX,
            path: request.path,
            allowInsecureHttp: options.allowInsecureHttp,
          }).toString()
          const headers = createHeaders(request, method, options.getToken, requestId)
          const timeout = resolveTimeout(request.timeoutMs, options.defaultTimeoutMs)
          const onAbort = () => {
            task?.abort()
            rejectRequest(createHttpError({ code: 'CANCELLED', message: '请求已取消', requestId }))
          }
          request.signal?.addEventListener('abort', onAbort, { once: true })
          removeSignalListener = () => request.signal?.removeEventListener('abort', onAbort)

          task = requestImpl({
            url,
            method,
            data: request.data,
            dataType: 'json',
            header: headers,
            timeout,
            success: resolveRequest,
            fail: (error) => rejectRequest(error),
          })
        } catch (error) {
          rejectRequest(error)
        }
      })

      return Object.assign(promise, {
        cancel() {
          if (settled) {
            return
          }
          task?.abort()
          rejectRequest(createHttpError({ code: 'CANCELLED', message: '请求已取消', requestId }))
        },
      })
    },
  }
}

function createHeaders(
  request: MiniProgramHttpRequest<unknown>,
  method: MiniProgramRequestOption['method'],
  getToken: (() => string | undefined) | undefined,
  requestId: string,
): Record<string, string> {
  let token: string | undefined
  try {
    token = getToken?.()
  } catch {
    throw createHttpError({
      code: 'CONFIGURATION_ERROR',
      message: '鉴权配置读取失败',
      requestId,
    })
  }
  return {
    accept: 'application/json',
    ...(request.data === undefined || method === 'GET'
      ? {}
      : { 'content-type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Request-Id': requestId,
    ...request.headers,
  }
}

function resolveTimeout(
  requestTimeoutMs: number | undefined,
  defaultTimeoutMs: number | undefined,
): number {
  const timeout = requestTimeoutMs ?? defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: '请求超时时间无效' })
  }
  return timeout
}

function parseResponse<TResponse>(
  response: MiniProgramResponse,
  request: MiniProgramHttpRequest<TResponse>,
  fallbackRequestId: string,
): TResponse {
  const requestId = getHeader(response.header, 'x-request-id') ?? fallbackRequestId

  if (response.statusCode === 204) {
    return parsePayload(undefined, request.parse, 204, requestId)
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw mapHttpResponse(response.statusCode, response.data, requestId)
  }

  return parsePayload(response.data, request.parse, response.statusCode, requestId)
}

function parsePayload<TResponse>(
  data: unknown,
  parse: ((value: unknown) => TResponse) | undefined,
  status: number,
  requestId: string,
): TResponse {
  if (!parse) {
    return data as TResponse
  }

  try {
    return parse(data)
  } catch {
    throw createHttpError({
      code: 'INVALID_RESPONSE',
      message: '响应内容与契约不符',
      status,
      requestId,
      details: null,
    })
  }
}

function mapHttpResponse(status: number, data: unknown, requestId: string): HttpError {
  const code = httpErrorFromStatus(status)
  const body = asObject(data)
  const error = asObject(body?.error)
  const backendCode = typeof error?.code === 'string' ? error.code : null
  const message =
    typeof error?.message === 'string'
      ? error.message
      : status >= 500
        ? '服务器暂时不可用'
        : '请求失败'
  const responseRequestId = typeof body?.requestId === 'string' ? body.requestId : requestId

  return createHttpError({
    code: status >= 500 ? 'SERVER_ERROR' : code,
    message,
    status,
    backendCode,
    requestId: responseRequestId,
    details: redactSensitive(error?.details ?? null),
  })
}

function mapRequestFailure(error: unknown, requestId: string): HttpError {
  const message = getFailureMessage(error).toLowerCase()
  const code = message.includes('timeout')
    ? 'TIMEOUT'
    : isMiniProgramFailure(error)
      ? 'NETWORK_ERROR'
      : message.includes('abort') || message.includes('cancel')
        ? 'CANCELLED'
        : 'UNKNOWN'
  return createHttpError({
    code,
    message:
      code === 'TIMEOUT'
        ? '请求超时'
        : code === 'NETWORK_ERROR'
          ? '网络不可用'
          : code === 'CANCELLED'
            ? '请求已取消'
            : '请求处理失败',
    requestId,
  })
}

function isMiniProgramFailure(error: unknown): error is MiniProgramFailure {
  return error !== null && typeof error === 'object' && ('errMsg' in error || 'errCode' in error)
}

function getFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (error && typeof error === 'object' && 'errMsg' in error && typeof error.errMsg === 'string') {
    return error.errMsg
  }
  return String(error)
}

function reportRequestError(
  monitor: Pick<Monitor, 'captureError'>,
  error: HttpError,
  context: Record<string, unknown>,
): void {
  try {
    monitor.captureError(error, {
      action: REQUEST_ACTION,
      ...context,
      code: error.code,
      status: error.serialized.status,
    })
  } catch {
    // 监控故障不能覆盖原始请求错误。
  }
}

function getHeader(header: Record<string, unknown>, name: string): string | undefined {
  const key = Object.keys(header).find((candidate) => candidate.toLowerCase() === name)
  const value = key ? header[key] : undefined
  return typeof value === 'string' ? value : undefined
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function defaultRequest(options: MiniProgramRequestOption): MiniProgramRequestTask {
  return wx.request(options as unknown as WechatMiniprogram.RequestOption)
}

function defaultRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
