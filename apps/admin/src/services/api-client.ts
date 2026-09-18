/**
 * 管理端 API 客户端:直连 oRPC OpenAPI REST.
 * 会话令牌仅经 getter 注入内存,不写入 localStorage.
 * 同时解析 oRPC {code,message} 与 Nest 过滤器 {error:{code,message}}.
 */

export class AdminApiError extends Error {
  readonly code: string
  readonly status: number
  readonly requestId: string | null
  readonly retryAfterMs: number | null

  constructor(
    code: string,
    message: string,
    status: number,
    options?: { requestId?: string | null; retryAfterMs?: number | null },
  ) {
    super(message)
    this.name = 'AdminApiError'
    this.code = code
    this.status = status
    this.requestId = options?.requestId ?? null
    this.retryAfterMs = options?.retryAfterMs ?? null
  }
}

export type AdminClientOptions = {
  baseUrl: string
  getToken: () => string | null
  onUnauthorized?: () => void
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) {
return null
}
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) {
return Math.round(seconds * 1000)
}
  const date = Date.parse(header)
  if (Number.isNaN(date)) {
return null
}
  return Math.max(0, date - Date.now())
}

function readErrorPayload(payload: Record<string, unknown>, status: number) {
  const nested = payload.error as { code?: string; message?: string } | undefined
  const code = typeof payload.code === 'string' ? payload.code : (nested?.code ?? `HTTP_${status}`)
  const message =
    typeof payload.message === 'string' ? payload.message : (nested?.message ?? '请求失败')
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : null
  return { code, message, requestId }
}

export class AdminClient {
  constructor(private readonly options: AdminClientOptions) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.options.getToken()
    let response: Response
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method,
        signal: AbortSignal.timeout(30_000),
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw error instanceof Error ? error : new Error('网络异常')
    }

    if (response.status === 401) {
      this.options.onUnauthorized?.()
    }

    const text = await response.text()
    let payload: Record<string, unknown> = {}
    let invalidJson = false
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          payload = parsed as Record<string, unknown>
        }
      } catch {
        invalidJson = true
      }
    }

    if (!response.ok) {
      const { code, message, requestId } = invalidJson
        ? { code: `HTTP_${response.status}`, message: '请求失败', requestId: null }
        : readErrorPayload(payload, response.status)
      throw new AdminApiError(code, message, response.status, {
        requestId,
        retryAfterMs: parseRetryAfter(response.headers.get('Retry-After')),
      })
    }

    if (invalidJson) {
      throw new AdminApiError('INVALID_JSON', '响应不是合法 JSON', 502)
    }

    return payload as T
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }
}

/** 解析查询串;null/undefined/空字符串省略. */
export function toQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export function isVersionConflict(error: unknown): boolean {
  return (
    error instanceof AdminApiError && (error.status === 409 || /VERSION_CONFLICT/i.test(error.code))
  )
}

export function isForbidden(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 403
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 401
}

export function isServerError(error: unknown): boolean {
  return error instanceof AdminApiError && error.status >= 500
}
