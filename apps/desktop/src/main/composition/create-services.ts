import { HttpError, createHttpError } from '@studycommit/common/http'
import { LearningLogClient, type LearningLogApi } from '@studycommit/common/learning-log'
import { StudySessionClient, type StudySessionApi } from '@studycommit/common/study-session'
import { TopicClient, type TopicQueryApi } from '@studycommit/common/topic'
import { ElectronNetTransport } from '../http/electron-net-transport'

export interface DesktopServices {
  studySessions: StudySessionApi
  topics: TopicQueryApi
  learningLogs: LearningLogApi
}

export function createDesktopServices(env: NodeJS.ProcessEnv = process.env): DesktopServices {
  const origin = env.STUDYCOMMIT_API_ORIGIN
  const apiPrefix = env.STUDYCOMMIT_API_PREFIX ?? '/api'
  if (!origin) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: '缺少 STUDYCOMMIT_API_ORIGIN' })
  }

  const allowInsecureHttp =
    env.NODE_ENV !== 'production' || env.STUDYCOMMIT_ALLOW_INSECURE_HTTP === 'true'
  const transport = new ElectronNetTransport({
    origin,
    apiPrefix,
    allowInsecureHttp,
    defaultTimeoutMs: 10_000,
    getHeaders: async () => createDesktopHeaders(env),
  })
  return {
    studySessions: new StudySessionClient(transport),
    topics: new TopicClient(transport),
    learningLogs: new LearningLogClient(transport),
  }
}

export function resolveDesktopServices(env: NodeJS.ProcessEnv = process.env): DesktopServices {
  try {
    return createDesktopServices(env)
  } catch (error) {
    const httpError =
      error instanceof HttpError
        ? error
        : createHttpError({
            code: 'CONFIGURATION_ERROR',
            message: error instanceof Error ? error.message : '请求层配置无效',
          })
    console.error('[studycommit] 请求层配置无效', httpError.message)
    return createUnavailableServices(httpError)
  }
}

function createUnavailableServices(error: HttpError): DesktopServices {
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

function createDesktopHeaders(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (env.NODE_ENV !== 'production' && env.STUDYCOMMIT_DEV_USER_ID) {
    headers['x-user-id'] = env.STUDYCOMMIT_DEV_USER_ID
  }
  return headers
}
