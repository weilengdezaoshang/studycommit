import { StudySessionClient } from '@studycommit/common/study-session'
import {
  createDevelopmentHeaderProvider,
  getMobileApiOrigin,
  getMobileApiPrefix,
} from '../config/api-config'
import { ReactNativeFetchTransport } from './react-native-fetch-transport'

export interface MobileServices {
  studySessions: StudySessionClient
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
    getHeaders: options?.getHeaders ?? createDevelopmentHeaderProvider(options?.developmentUserId),
  })
  return { studySessions: new StudySessionClient(transport) }
}
