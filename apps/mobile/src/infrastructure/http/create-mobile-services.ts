import * as Crypto from 'expo-crypto'
import { HttpError, createHttpError } from '@studycommit/common/http'
import { createApiOrpcClient, createOrpcServices } from '@studycommit/common/adapters/orpc'
import type {
  AiApi,
  LearningLogApi,
  PaperApi,
  PuzzleApi,
  ReviewApi,
  SearchApi,
  StudySessionApi,
  TopicMutationApi,
  UploadsApi,
} from '@studycommit/common/ports'
import {
  allowsInsecureHttpFor,
  createDevelopmentHeaderProvider,
  getMobileApiOrigin,
  getMobileApiPrefix,
  getMobileDevelopmentUserId,
} from '../config/api-config'
import { getAuthHeaders } from '../auth/session-store'

export interface MobileServices {
  studySessions: StudySessionApi
  topics: TopicMutationApi
  learningLogs: LearningLogApi
  papers: PaperApi
  puzzles?: PuzzleApi
  ai: AiApi
  uploads: UploadsApi
  reviews: ReviewApi
  search: SearchApi
}

export function createMobileServices(options?: {
  fetchImpl?: typeof fetch
  getHeaders?: () => Promise<Readonly<Record<string, string>>>
  developmentUserId?: string
}): MobileServices {
  const fetchImpl = options?.fetchImpl ?? fetch
  const getHeaders =
    options?.getHeaders ??
    (async () => {
      const developmentHeaders = await createDevelopmentHeaderProvider(
        options?.developmentUserId ?? getMobileDevelopmentUserId(),
      )()
      return { ...developmentHeaders, ...(await getAuthHeaders()) }
    })
  const client = createApiOrpcClient({
    origin: getMobileApiOrigin(),
    apiPrefix: getMobileApiPrefix(),
    allowInsecureHttp: allowsInsecureHttpFor(getMobileApiOrigin()),
    fetchImpl,
    getHeaders,
  })
  return createOrpcServices(client, { createIdempotencyKey: () => Crypto.randomUUID() })
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
      completePaper: reject,
      createFragment: reject,
      updateFragment: reject,
      listFragments: reject,
    },
    topics: {
      listActive: reject,
      create: reject,
      update: reject,
      remove: reject,
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
      updateQuestion: reject,
      restore: reject,
    },
    puzzles: { album: reject, selectArtwork: reject, reveal: reject, featureArtwork: reject },
    ai: {
      quote: reject,
      explainRun: reject,
      getRun: reject,
      confirmPaperExplain: reject,
    },
    uploads: {
      create: reject,
      complete: reject,
      remove: reject,
      access: reject,
    },
    reviews: {
      monthly: reject,
    },
    search: {
      query: reject,
    },
  }
}
