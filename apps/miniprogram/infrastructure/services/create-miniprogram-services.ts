import type { MiniprogramBackendMode } from '../../shared/service-runtime/index'
import { createMiniprogramTransport } from '../transport/create-transport'
import type { MiniprogramTransport } from '../transport/transport.types'
import { createAuthService, type AuthService } from './auth-service'
import { createCapabilitiesService, type CapabilitiesService } from './capabilities-service'
import { MINIPROGRAM_OPERATIONS } from './operations'
import { createOcrService, type OcrService } from './ocr-service'
import { createPapersService, type PapersService } from './papers-service'
import { createSearchService, type SearchService } from './search-service'
import { createStudySessionsService, type StudySessionsService } from './study-sessions-service'
import { createTopicsService, type TopicsService } from './topics-service'
import { createUploadsService, type UploadsService } from './uploads-service'

/** 小程序统一业务服务入口：页面只允许从这里获取服务。 */
export interface MiniprogramServices {
  auth: AuthService
  papers: PapersService
  uploads: UploadsService
  ocr: OcrService
  topics: TopicsService
  search: SearchService
  studySessions: StudySessionsService
  capabilities: CapabilitiesService
}

export interface CreateMiniprogramServicesOptions {
  mode: MiniprogramBackendMode
  /** 云函数异常时读请求是否允许回退 HTTP；必须由明确配置开启。 */
  allowHttpFallback?: boolean
  createRequestId?: () => string
  /** 测试注入。 */
  transport?: MiniprogramTransport
  cloudCallFunction?: Parameters<typeof createMiniprogramTransport>[0]['cloudCallFunction']
  cloudAvailable?: () => boolean
  httpRequest?: Parameters<typeof createMiniprogramTransport>[0]['httpRequest']
}

export function createMiniprogramServices(
  options: CreateMiniprogramServicesOptions,
): MiniprogramServices {
  const transport =
    options.transport ??
    createMiniprogramTransport({
      mode: options.mode,
      allowHttpFallback: options.allowHttpFallback,
      registry: MINIPROGRAM_OPERATIONS,
      createRequestId: options.createRequestId ?? defaultRequestId,
      ...(options.cloudCallFunction ? { cloudCallFunction: options.cloudCallFunction } : {}),
      ...(options.cloudAvailable ? { cloudAvailable: options.cloudAvailable } : {}),
      ...(options.httpRequest ? { httpRequest: options.httpRequest } : {}),
    })
  const capabilities = createCapabilitiesService({ mode: options.mode, transport })
  return {
    auth: createAuthService({ transport }),
    papers: createPapersService({ transport }),
    uploads: createUploadsService({
      transport,
      mode: options.mode,
      getMaxImageBytes: () => capabilities.get().maxImageBytes,
    }),
    ocr: createOcrService({
      mode: options.mode,
      transport,
      ...(options.cloudCallFunction
        ? {
            callFunction: (request: { name: string; data: unknown }) =>
              options.cloudCallFunction!(request as never),
          }
        : {}),
      ...(options.cloudAvailable ? { cloudAvailable: options.cloudAvailable } : {}),
    }),
    topics: createTopicsService(transport),
    search: createSearchService(transport),
    studySessions: createStudySessionsService(transport),
    capabilities,
  }
}

function defaultRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
