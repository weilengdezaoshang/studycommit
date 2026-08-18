import { apiErrorResponseSchema } from '../contracts/api-error'
import { createApiUrl } from './create-api-url'
import {
  createHttpError,
  HttpError,
  httpErrorFromStatus,
  type SerializedHttpError,
} from './http-error'
import type { HttpRequest } from './http-request'
import type { HttpTransport } from './http-transport'
import { mergeAbortSignals } from './merge-abort-signals'
import { redactSensitive, summarizeErrorBody } from './redact-sensitive'

export interface JsonHttpTransportOptions {
  origin: string
  apiPrefix: string
  fetchImpl: typeof fetch
  getHeaders(): Promise<Readonly<Record<string, string>>>
  defaultTimeoutMs: number
  allowInsecureHttp?: boolean
  onLog?: (event: { message: string; data?: Record<string, unknown> }) => void
}

export class JsonHttpTransport implements HttpTransport {
  constructor(private readonly options: JsonHttpTransportOptions) {}

  async request<TResponse>(request: HttpRequest<TResponse>): Promise<TResponse> {
    const url = createApiUrl({
      origin: this.options.origin,
      apiPrefix: this.options.apiPrefix,
      path: request.path,
      allowInsecureHttp: this.options.allowInsecureHttp,
    })
    const timeoutMs = request.timeoutMs ?? this.options.defaultTimeoutMs
    const { signal, didTimeout, cleanup } = mergeAbortSignals(request.signal, timeoutMs)
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(await this.options.getHeaders()),
      ...request.headers,
    }
    if (
      request.method !== 'GET' &&
      request.body !== undefined &&
      !hasHeader(headers, 'content-type')
    ) {
      headers['content-type'] = 'application/json'
    }

    try {
      const response = await this.options.fetchImpl(url, {
        method: request.method,
        headers,
        body:
          request.method === 'GET' || request.body === undefined
            ? undefined
            : JSON.stringify(request.body),
        signal,
      })
      return await this.parseResponse(response, request)
    } catch (error) {
      throw this.mapFailure(error, didTimeout(), request.signal)
    } finally {
      cleanup()
    }
  }

  private async parseResponse<TResponse>(
    response: Response,
    request: HttpRequest<TResponse>,
  ): Promise<TResponse> {
    if (response.status === 204) {
      const empty = request.responseSchema.safeParse(undefined)
      if (empty.success) {
        return empty.data
      }
      const emptyNull = request.responseSchema.safeParse(null)
      if (emptyNull.success) {
        return emptyNull.data
      }
      throw createHttpError({
        code: 'INVALID_RESPONSE',
        message: '响应内容与契约不符',
        status: 204,
      })
    }

    const rawText = await response.text()
    const parsed = parseJsonBody(rawText, response.headers.get('content-type'))

    if (response.ok) {
      if (parsed.kind !== 'json') {
        this.options.onLog?.({
          message: '收到无法解析的成功响应',
          data: { status: response.status, preview: parsed.preview },
        })
        throw createHttpError({
          code: 'INVALID_RESPONSE',
          message: '响应内容与契约不符',
          status: response.status,
        })
      }
      const checked = request.responseSchema.safeParse(parsed.value)
      if (!checked.success) {
        throw createHttpError({
          code: 'INVALID_RESPONSE',
          message: '响应内容与契约不符',
          status: response.status,
        })
      }
      return checked.data
    }

    throw this.mapErrorResponse(response.status, parsed)
  }

  private mapErrorResponse(status: number, parsed: ReturnType<typeof parseJsonBody>): HttpError {
    const code = httpErrorFromStatus(status)
    if (parsed.kind !== 'json') {
      this.options.onLog?.({
        message: '收到无法解析的错误响应',
        data: { status, preview: parsed.preview },
      })
      return createHttpError({
        code: status >= 500 ? 'SERVER_ERROR' : code,
        message: status >= 500 ? '服务器暂时不可用' : '请求失败',
        status,
      })
    }

    const apiError = apiErrorResponseSchema.safeParse(parsed.value)
    if (!apiError.success) {
      return createHttpError({
        code: status >= 500 ? 'SERVER_ERROR' : code,
        message: status >= 500 ? '服务器暂时不可用' : '请求失败',
        status,
      })
    }

    return createHttpError({
      code,
      message: apiError.data.error.message,
      status,
      backendCode: apiError.data.error.code,
      requestId: apiError.data.requestId,
      details: apiError.data.error.details,
    })
  }

  private mapFailure(error: unknown, timedOut: boolean, userSignal?: AbortSignal): HttpError {
    if (error instanceof HttpError) {
      return error
    }
    if (timedOut) {
      return createHttpError({ code: 'TIMEOUT', message: '请求超时' })
    }
    if (userSignal?.aborted || isAbortError(error)) {
      return createHttpError({ code: 'CANCELLED', message: '请求已取消' })
    }
    return createHttpError({
      code: 'NETWORK_ERROR',
      message: '网络不可用',
      details: null,
    })
  }
}

export function loggableRequest(
  headers: Readonly<Record<string, string>>,
  body?: unknown,
): Record<string, unknown> {
  return redactSensitive({ headers, body }) as Record<string, unknown>
}

export function toSerializedError(error: unknown): SerializedHttpError {
  if (error instanceof HttpError) {
    return redactSensitive(error.serialized) as SerializedHttpError
  }
  return {
    code: 'UNKNOWN',
    message: '请求处理失败',
    status: null,
    backendCode: null,
    requestId: null,
    details: null,
  }
}

function parseJsonBody(
  text: string,
  contentType: string | null,
): { kind: 'json'; value: unknown } | { kind: 'invalid'; preview: string } {
  const type = contentType?.toLowerCase() ?? ''
  if (type.includes('html') || text.trimStart().startsWith('<')) {
    return { kind: 'invalid', preview: summarizeErrorBody(text) }
  }
  try {
    return { kind: 'json', value: JSON.parse(text || 'null') }
  } catch {
    return { kind: 'invalid', preview: summarizeErrorBody(text) }
  }
}

function hasHeader(headers: Readonly<Record<string, string>>, name: string): boolean {
  const target = name.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === target)
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
  )
}
