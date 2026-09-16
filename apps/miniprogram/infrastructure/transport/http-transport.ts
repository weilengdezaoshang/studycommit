import { ServiceError } from '../../shared/service-runtime/index'
import type { MiniProgramHttpRequest } from '../../services/http'
import { getMiniprogramHttpClient, getPublicMiniprogramHttpClient } from '../../services/api-client'
import { ensureServiceError, serviceErrorFromHttpError } from './transport-error'
import type {
  MiniprogramTransport,
  OperationRegistry,
  TransportCallOptions,
} from './transport.types'

type RequestAccess = 'public' | 'authed'

export type HttpTransportRequest = <TResponse>(
  request: MiniProgramHttpRequest<TResponse>,
  access: RequestAccess,
) => Promise<TResponse>

export interface CreateHttpTransportOptions {
  routes: OperationRegistry
  /** 默认复用现有 api-client（自动附带令牌与刷新）；测试注入。 */
  request?: HttpTransportRequest
}

function buildPath(route: NonNullable<OperationRegistry[string]['http']>, input: unknown): string {
  const rawPath = typeof route.path === 'function' ? route.path(input) : route.path
  if (!rawPath.startsWith('/') || rawPath.includes('//') || rawPath.includes('..')) {
    throw new ServiceError({ code: 'INVALID_INPUT', message: '请求路径非法', retryable: false })
  }
  return rawPath
}

function appendQuery(
  path: string,
  params: Record<string, string | number | undefined> | undefined,
): string {
  if (!params) {
    return path
  }
  const query = Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `${path}?${query}` : path
}

/**
 * HttpTransport：把统一 operation 映射到现有 oRPC REST 路由，
 * 复用现有 http.ts 客户端（超时、取消、错误归一、令牌注入）。
 */
export function createHttpTransport(options: CreateHttpTransportOptions): MiniprogramTransport {
  const request: HttpTransportRequest =
    options.request ??
    ((request, access) => {
      const client =
        access === 'public' ? getPublicMiniprogramHttpClient() : getMiniprogramHttpClient()
      return client.request(request)
    })

  return {
    async call<TInput, TOutput>(
      operation: string,
      input: TInput,
      callOptions?: TransportCallOptions,
    ): Promise<TOutput> {
      const route = options.routes[operation]
      if (!route?.http) {
        throw new ServiceError({
          code: 'SERVICE_DISABLED',
          message: `HTTP 模式不支持操作：${operation}`,
          retryable: false,
        })
      }
      const path = appendQuery(buildPath(route.http, input), route.http.query?.(input))
      const method = route.http.method
      try {
        return await request<TOutput>(
          {
            method,
            path,
            ...(method === 'GET' ? {} : { data: input ?? {} }),
            ...(callOptions?.idempotencyKey
              ? { headers: { 'idempotency-key': callOptions.idempotencyKey } }
              : {}),
            timeoutMs: callOptions?.timeoutMs,
            signal: callOptions?.signal,
          },
          route.http.access ?? 'authed',
        )
      } catch (error) {
        // HttpError 已结构化，直接归一；其余异常收敛为 UNKNOWN/NETWORK_ERROR。
        if (error && typeof error === 'object' && 'serialized' in error) {
          throw serviceErrorFromHttpError(error as never)
        }
        throw ensureServiceError(error, 'UNKNOWN')
      }
    },
  }
}
