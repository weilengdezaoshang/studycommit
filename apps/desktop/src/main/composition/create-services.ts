import { HttpError, createHttpError } from '@studycommit/common/http'
import { createServices } from '@studycommit/common/services'
import type {
  AiApi,
  LearningLogApi,
  PaperApi,
  StudySessionApi,
  TopicApi,
} from '@studycommit/common/ports'
import { DesktopAuthApi, type DesktopAuthApiPort } from '../auth/auth-client'
import { DesktopAuthSessionStore } from '../auth/session-store'
import { ElectronNetTransport } from '../http/electron-net-transport'

export interface DesktopServices {
  studySessions: StudySessionApi
  topics: TopicApi
  learningLogs: LearningLogApi
  papers: PaperApi
  ai: AiApi
  auth: DesktopAuthApiPort
}

export function createDesktopServices(
  env: NodeJS.ProcessEnv = process.env,
  options?: { fetchImpl?: typeof fetch; sessionStore?: DesktopAuthSessionStore },
): DesktopServices {
  const origin = env.STUDYCOMMIT_API_ORIGIN
  const apiPrefix = env.STUDYCOMMIT_API_PREFIX ?? '/api'
  if (!origin) {
    throw createHttpError({ code: 'CONFIGURATION_ERROR', message: '缺少 STUDYCOMMIT_API_ORIGIN' })
  }

  const allowInsecureHttp =
    env.NODE_ENV !== 'production' || env.STUDYCOMMIT_ALLOW_INSECURE_HTTP === 'true'
  const sessions = options?.sessionStore ?? new DesktopAuthSessionStore()
  const transportOptions = {
    origin,
    apiPrefix,
    allowInsecureHttp,
    defaultTimeoutMs: 10_000,
    fetchImpl: options?.fetchImpl,
  }
  const publicTransport = new ElectronNetTransport({
    ...transportOptions,
    getHeaders: async () => ({ accept: 'application/json' }),
  })
  const transport = new ElectronNetTransport({
    ...transportOptions,
    getHeaders: async () => ({
      accept: 'application/json',
      ...(await sessions.authorizationHeaders()),
      ...createDesktopDevHeaders(env),
    }),
  })
  const auth = new DesktopAuthApi(sessions, publicTransport)
  sessions.bindRefresh((refreshToken) => auth.refresh(refreshToken))
  return {
    ...createServices({ transport: 'rest', httpTransport: transport }),
    auth,
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
      create: reject,
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
      companionFollowup: reject,
    },
    learningLogs: {
      list: reject,
      getBySession: reject,
      update: reject,
    },
    auth: {
      registerAccount: reject,
      loginAccount: reject,
    },
  }
}

function createDesktopDevHeaders(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> {
  if (env.NODE_ENV !== 'production' && env.STUDYCOMMIT_DEV_USER_ID) {
    return { 'x-user-id': env.STUDYCOMMIT_DEV_USER_ID }
  }
  return {}
}
