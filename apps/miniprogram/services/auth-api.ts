import { authTokensSchema, verifyPhoneOutputSchema } from '@studycommit/rpc-contracts/auth'
import { getMiniprogramHttpClient, getPublicMiniprogramHttpClient } from './api-client'
import { HttpError } from './http'
import {
  clearStoredSession,
  getStoredSession,
  setSessionRefreshHandler,
  setStoredSession,
} from './auth-session'

export async function loginWechatMiniprogram(code: string) {
  const response = await getPublicMiniprogramHttpClient().request({
    method: 'POST',
    path: '/auth/wechat/miniprogram',
    data: { code },
    parse: (data) => verifyPhoneOutputSchema.parse(data),
  })
  setStoredSession(response)
}

export async function refreshAuthSession() {
  const session = getStoredSession()
  if (!session) {
    throw new Error('未登录')
  }
  try {
    const tokens = await getPublicMiniprogramHttpClient().request({
      method: 'POST',
      path: '/auth/token/refresh',
      data: { refreshToken: session.tokens.refreshToken },
      parse: (data) => authTokensSchema.parse(data),
    })
    setStoredSession({ user: session.user, tokens })
  } catch (error) {
    if (error instanceof HttpError && error.code === 'UNAUTHORIZED') {
      clearStoredSession()
    }
    throw error
  }
}

export async function logoutAuthSession() {
  const token = getStoredSession()?.tokens.accessToken
  if (token) {
    try {
      await getMiniprogramHttpClient().request({
        method: 'POST',
        path: '/auth/logout',
      })
    } catch {
      // 本地仍需退出
    }
  }
  clearStoredSession()
}

setSessionRefreshHandler(refreshAuthSession)
