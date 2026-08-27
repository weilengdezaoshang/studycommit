import { monitor as defaultMonitor, type Monitor } from './monitor-adapter'

export type HttpErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN'

export type SerializedHttpError = {
  code: HttpErrorCode
  message: string
  status: number | null
  backendCode: string | null
  requestId: string | null
  details: unknown
}

export class HttpError extends Error {
  readonly serialized: SerializedHttpError

  constructor(error: SerializedHttpError, options?: ErrorOptions) {
    super(error.message, options)
    this.name = 'HttpError'
    this.serialized = error
  }

  get code(): HttpErrorCode {
    return this.serialized.code
  }
}

export function createHttpError(
  error: Omit<SerializedHttpError, 'status' | 'backendCode' | 'requestId' | 'details'> &
    Partial<SerializedHttpError>,
  options?: ErrorOptions,
): HttpError {
  return new HttpError(
    {
      code: error.code,
      message: error.message,
      status: error.status ?? null,
      backendCode: error.backendCode ?? null,
      requestId: error.requestId ?? null,
      details: error.details ?? null,
    },
    options,
  )
}

const DEFAULT_API_PREFIX = '/api'
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 120_000
const REQUEST_ACTION = 'http_request'
const DANGEROUS_PROTOCOL = /^(javascript|data|file|vbscript):/i
const SENSITIVE_KEYS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-user-id',
  'password',
  'token',
])
const MAX_TEXT_LENGTH = 256

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

function createApiUrl(options: {
  origin: string
  apiPrefix: string
  path: string
  allowInsecureHttp?: boolean
}): URL {
  const originUrl = parseOrigin(options.origin, options.allowInsecureHttp === true)
  const prefix = normalizeApiPrefix(options.apiPrefix)
  const path = normalizeBusinessPath(options.path)
  return new URL(`${originUrl.origin}${prefix}${path}`)
}

function httpErrorFromStatus(status: number): HttpErrorCode {
  if (status === 401) {
    return 'UNAUTHORIZED'
  }
  if (status === 403) {
    return 'FORBIDDEN'
  }
  if (status === 404) {
    return 'NOT_FOUND'
  }
  if (status === 409) {
    return 'CONFLICT'
  }
  if (status === 429) {
    return 'RATE_LIMITED'
  }
  if (status >= 500) {
    return 'SERVER_ERROR'
  }
  return 'UNKNOWN'
}

function redactSensitive(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}…` : value
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  if (seen.has(value)) {
    return '[Circular]'
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen))
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? '[redacted]' : redactSensitive(item, seen),
    ]),
  )
}

function parseOrigin(origin: string, allowInsecureHttp: boolean): URL {
  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 无效' })
  }

  if (originUrl.username || originUrl.password || originUrl.search || originUrl.hash) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 无效' })
  }
  if (originUrl.pathname !== '/' && originUrl.pathname !== '') {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 不能包含业务路径' })
  }
  if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Origin 协议不受支持' })
  }
  if (originUrl.protocol === 'http:' && !allowInsecureHttp) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: '生产环境只允许 HTTPS' })
  }
  return originUrl
}

function normalizeApiPrefix(apiPrefix: string): string {
  const prefix = apiPrefix.trim()
  if (!prefix || prefix.includes('://') || prefix.startsWith('//') || prefix.includes('..')) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: 'API Prefix 无效' })
  }
  const withSlash = prefix.startsWith('/') ? prefix : `/${prefix}`
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash
}

function normalizeBusinessPath(path: string): string {
  const value = path.trim()
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('://') ||
    value.includes('..') ||
    DANGEROUS_PROTOCOL.test(value)
  ) {
    throw createHttpError({ code: 'INVALID_RESPONSE', message: '请求路径不受支持' })
  }
  return value
}
