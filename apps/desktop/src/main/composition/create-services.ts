import { StudySessionClient } from '@studycommit/common/study-session'
import { createHttpError } from '@studycommit/common/http'
import { ElectronNetTransport } from '../http/electron-net-transport'

export interface DesktopServices {
  studySessions: StudySessionClient
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
  return { studySessions: new StudySessionClient(transport) }
}

function createDesktopHeaders(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (env.NODE_ENV !== 'production' && env.STUDYCOMMIT_DEV_USER_ID) {
    headers['x-user-id'] = env.STUDYCOMMIT_DEV_USER_ID
  }
  return headers
}
