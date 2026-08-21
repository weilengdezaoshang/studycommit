import { HttpError, createHttpError } from '@studycommit/common/http'
import { LearningLogClient, type LearningLogApi } from '@studycommit/common/learning-log'
import { StudySessionClient, type StudySessionApi } from '@studycommit/common/study-session'
import { TopicClient, type TopicQueryApi } from '@studycommit/common/topic'
import {
  createDevelopmentHeaderProvider,
  getMobileApiOrigin,
  getMobileApiPrefix,
  getMobileDevelopmentUserId,
} from '../config/api-config'
import { ReactNativeFetchTransport } from './react-native-fetch-transport'

export interface MobileServices {
  studySessions: StudySessionApi
  topics: TopicQueryApi
  learningLogs: LearningLogApi
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
    allowInsecureHttp: true,
    defaultTimeoutMs: 10_000,
    getHeaders:
      options?.getHeaders ??
      createDevelopmentHeaderProvider(options?.developmentUserId ?? getMobileDevelopmentUserId()),
  })
  return {
    studySessions: new StudySessionClient(transport),
    topics: new TopicClient(transport),
    learningLogs: new LearningLogClient(transport),
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
    },
    learningLogs: {
      getBySession: reject,
      update: reject,
    },
  }
}
