import { createORPCClient } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { apiContract } from '@studycommit/rpc-contracts'
import { createApiUrl } from '../../http/create-api-url'

/** oRPC 调用上下文:幂等键通过它进入 idempotency-key 请求头。 */
export interface OrpcClientContext {
  idempotencyKey?: string
}

/** 与后端 apiContract 对齐的完整 oRPC 客户端。 */
export type ApiOrpcClient = ContractRouterClient<typeof apiContract, OrpcClientContext>

export interface CreateApiOrpcClientOptions {
  origin: string
  apiPrefix: string
  allowInsecureHttp?: boolean
  fetchImpl?: typeof fetch
  getHeaders: () => Promise<Readonly<Record<string, string>>>
}

export function createApiOrpcClient(options: CreateApiOrpcClientOptions): ApiOrpcClient {
  const baseUrl = createApiUrl({
    origin: options.origin,
    apiPrefix: options.apiPrefix,
    path: '/',
    allowInsecureHttp: options.allowInsecureHttp,
  })
  baseUrl.pathname = baseUrl.pathname.replace(/\/$/, '')
  const link = new OpenAPILink<OrpcClientContext>(apiContract, {
    url: baseUrl,
    headers: async ({ context }) => ({
      ...(await options.getHeaders()),
      ...(context.idempotencyKey ? { 'idempotency-key': context.idempotencyKey } : {}),
    }),
    ...(options.fetchImpl
      ? {
          fetch: (request, init) => options.fetchImpl!(request, init as RequestInit),
        }
      : {}),
  })
  return createORPCClient<ApiOrpcClient>(link)
}
