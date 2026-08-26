type ApiEnvironment = 'local' | 'lan' | 'production'

const API_URLS: Record<ApiEnvironment, string> = {
  local: 'http://localhost:3000',
  lan: 'http://192.168.1.100:3000',
  production: 'https://api.studycommit.com',
}

export function getApiBaseUrl(): string {
  const envVersion = wx.getAccountInfoSync().miniProgram.envVersion
  return envVersion === 'release' ? API_URLS.production : API_URLS.local
}

export { API_URLS }
