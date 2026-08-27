import { API_URLS, WECHAT_ENV_VERSIONS } from '../constants/api'

export function getApiBaseUrl(): string {
  const envVersion = wx.getAccountInfoSync().miniProgram.envVersion
  return envVersion === WECHAT_ENV_VERSIONS.RELEASE ? API_URLS.production : API_URLS.local
}

export { API_URLS }
