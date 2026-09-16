import { ServiceError, type MiniprogramBackendMode } from '../../shared/service-runtime/index'
import { createCloudFunctionTransport } from './cloud-function-transport'
import { createHttpTransport, type HttpTransportRequest } from './http-transport'
import { isFallbackEligible } from './transport-error'
import type {
  MiniprogramTransport,
  OperationRegistry,
  TransportCallOptions,
} from './transport.types'

export interface TransportFactoryOptions {
  /** 后端模式：页面与业务 Store 不得自行判断，只由这里依据配置决定。 */
  mode: MiniprogramBackendMode
  /** 云函数模式异常时是否允许读请求回退 HTTP；必须由明确配置开启。 */
  allowHttpFallback?: boolean
  registry: OperationRegistry
  cloudFunctionName?: string
  createRequestId: () => string
  /** 测试注入。 */
  cloudCallFunction?: Parameters<typeof createCloudFunctionTransport>[0]['callFunction']
  cloudAvailable?: () => boolean
  httpRequest?: HttpTransportRequest
}

/**
 * createMiniprogramTransport：按配置装配主传输，并实现受控回退：
 * - 仅 read 操作、且配置允许、且故障属于网络层/服务端故障时才回退 HTTP；
 * - 写操作绝不自动回退重放（避免重复提交）；调用方带着同一幂等键显式重试。
 */
export function createMiniprogramTransport(options: TransportFactoryOptions): MiniprogramTransport {
  const http = createHttpTransport({
    routes: options.registry,
    ...(options.httpRequest ? { request: options.httpRequest } : {}),
  })
  const primary =
    options.mode === 'cloud-function'
      ? createCloudFunctionTransport({
          createRequestId: options.createRequestId,
          ...(options.cloudFunctionName ? { functionName: options.cloudFunctionName } : {}),
          ...(options.cloudCallFunction ? { callFunction: options.cloudCallFunction } : {}),
          ...(options.cloudAvailable ? { cloudAvailable: options.cloudAvailable } : {}),
        })
      : http

  return {
    call<TInput, TOutput>(
      operation: string,
      input: TInput,
      callOptions?: TransportCallOptions,
    ): Promise<TOutput> {
      const route = options.registry[operation]
      if (options.mode !== 'cloud-function' || !options.allowHttpFallback) {
        return primary.call<TInput, TOutput>(operation, input, callOptions)
      }
      const isRead = route?.kind !== 'write'
      return primary.call<TInput, TOutput>(operation, input, callOptions).catch((error) => {
        if (isRead && isFallbackEligible(error)) {
          return http.call<TInput, TOutput>(operation, input, callOptions)
        }
        throw error
      })
    },
  }
}

/** 供调用方判断是否为可回退故障（测试与诊断用）。 */
export { isFallbackEligible, ServiceError }
