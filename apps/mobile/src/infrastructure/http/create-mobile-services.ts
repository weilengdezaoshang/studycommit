import { HttpError, createHttpError } from '@studycommit/common/http'
import { createServices } from '@studycommit/common/services'
import type {
  AiApi,
  LearningLogApi,
  PaperApi,
  StudySessionApi,
  TopicApi,
} from '@studycommit/common/ports'
import {
  allowsInsecureHttpFor,
  createDevelopmentHeaderProvider,
  getMobileApiOrigin,
  getMobileApiPrefix,
  getMobileDevelopmentUserId,
} from '../config/api-config'
import { getAuthHeaders } from '../auth/session-store'
import { ReactNativeFetchTransport } from './react-native-fetch-transport'

export interface MobileServices {
  studySessions: StudySessionApi
  topics: TopicApi
  learningLogs: LearningLogApi
  papers: PaperApi
  ai: AiApi
}

export function createMobileServices(options?: {
  fetchImpl?: typeof fetch
  getHeaders?: () => Promise<Readonly<Record<string, string>>>
  developmentUserId?: string
}): MobileServices {
  const transport = new ReactNativeFetchTransport({
    origin: getMobileApiOrigin(),
    apiPrefix: getMobileApiPrefix(),
    fetchImpl: options?.fetchImpl,
    allowInsecureHttp: allowsInsecureHttpFor(getMobileApiOrigin()),
    defaultTimeoutMs: 10_000,
    getHeaders:
      options?.getHeaders ??
      (async () => {
        const developmentHeaders = await createDevelopmentHeaderProvider(
          options?.developmentUserId ?? getMobileDevelopmentUserId(),
        )()
        return { ...developmentHeaders, ...(await getAuthHeaders()) }
      }),
  })
  return {
    ...createServices({ transport: 'rest', httpTransport: transport }),
  }
}

export function resolveMobileServices(
  options?: Parameters<typeof createMobileServices>[0],
): MobileServices {
  try {
    return createMobileServices(options)
  } catch (error) {
    const httpError =
      error instanceof HttpError
        ? error
        : createHttpError({
            code: 'CONFIGURATION_ERROR',
            message: error instanceof Error ? error.message : '请求层配置无效',
          })
    return createUnavailableServices(httpError)
  }
}

function createUnavailableServices(error: HttpError): MobileServices {
  const reject = async (): Promise<never> => {
    throw error
  }
  return {
    studySessions: {
      create: reject,
      getActive: reject,
      getById: reject,
      pause: reject,
      resume: reject,
      complete: reject,
    },
    topics: {
      listActive: reject,
      create: reject,
    },
    learningLogs: {
      list: reject,
      getBySession: reject,
      update: reject,
    },
    papers: {
      list: reject,
      create: reject,
      update: reject,
      organize: reject,
      moveToInbox: reject,
      remove: reject,
    },
    ai: {
      explainPaper: reject,
      confirmPaperExplain: reject,
    },
  }
}
