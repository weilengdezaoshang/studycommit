export type ApiEnvironment = 'local' | 'lan' | 'production'

export const API_ENVIRONMENTS = {
  LOCAL: 'local',
  LAN: 'lan',
  PRODUCTION: 'production',
} as const satisfies Record<string, ApiEnvironment>

export const API_URLS: Record<ApiEnvironment, string> = {
  [API_ENVIRONMENTS.LOCAL]: 'http://localhost:3000',
  [API_ENVIRONMENTS.LAN]: 'http://192.168.1.100:3000',
  [API_ENVIRONMENTS.PRODUCTION]: 'https://api.studycommit.com',
}

export const WECHAT_ENV_VERSIONS = {
  RELEASE: 'release',
} as const
