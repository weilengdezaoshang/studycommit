import { getApiBaseUrl } from './services/api-config'

App({
  globalData: {
    apiBaseUrl: getApiBaseUrl(),
  },
})
