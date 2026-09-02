import { getApiBaseUrl } from './api-config'
import { ensureFreshSession, getAccessToken } from './auth-session'
import { createMiniProgramHttpClient, type MiniProgramHttpRequest } from './http'

function createBaseClient() {
  const baseUrl = getApiBaseUrl()
  return createMiniProgramHttpClient({
    baseUrl,
    allowInsecureHttp: baseUrl.startsWith('http://'),
  })
}

export function getPublicMiniprogramHttpClient() {
  return createBaseClient()
}

export function getMiniprogramHttpClient() {
  const client = createMiniProgramHttpClient({
    baseUrl: getApiBaseUrl(),
    allowInsecureHttp: getApiBaseUrl().startsWith('http://'),
    getToken: () => getAccessToken(),
  })
  return {
    request<TResponse>(request: MiniProgramHttpRequest<TResponse>) {
      let inner: ReturnType<typeof client.request<TResponse>> | undefined
      const promise = ensureFreshSession().then(() => {
        inner = client.request(request)
        return inner
      }) as ReturnType<typeof client.request<TResponse>>
      promise.cancel = () => inner?.cancel()
      return promise
    },
  }
}
