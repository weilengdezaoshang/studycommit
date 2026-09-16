import { authTokensSchema, verifyPhoneOutputSchema } from '@studycommit/rpc-contracts/auth'
import { ServiceError } from '../../shared/service-runtime/index'
import {
  clearStoredSession,
  getStoredSession,
  isAccessExpired,
  setSessionRefreshHandler,
  setStoredSession,
} from '../../services/auth-session'
import type { MiniprogramTransport } from '../transport/transport.types'

export type WxLogin = () => Promise<string>

const defaultWxLogin: WxLogin = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: (result) => {
        if (result.code) {
          resolve(result.code)
          return
        }
        reject(new Error('未取得微信登录码'))
      },
      fail: (error) => reject(new Error(error.errMsg || '微信登录失败')),
    })
  })

export interface AuthService {
  /** 启动引导：有效会话直接通过，否则刷新或静默登录。 */
  ensureSession(): Promise<boolean>
  /** 会话存在但临近过期时刷新；无会话为空操作。 */
  ensureFresh(): Promise<void>
  /** wx.login code 换取会话（云函数模式下由服务端 OPENID 解析身份）。 */
  login(code: string): Promise<void>
  refresh(): Promise<void>
  logout(): Promise<void>
  isAuthenticated(): boolean
}

export interface CreateAuthServiceOptions {
  transport: MiniprogramTransport
  wxLogin?: WxLogin
}

export function createAuthService(options: CreateAuthServiceOptions): AuthService {
  const { transport } = options
  const wxLogin = options.wxLogin ?? defaultWxLogin

  const refresh = async (): Promise<void> => {
    const session = getStoredSession()
    if (!session) {
      throw new ServiceError({ code: 'UNAUTHENTICATED', message: '未登录', retryable: false })
    }
    try {
      const tokens = await transport
        .call('auth.refresh', { refreshToken: session.tokens.refreshToken })
        .then((value) => authTokensSchema.parse(value))
      setStoredSession({ user: session.user, tokens })
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'UNAUTHENTICATED') {
        clearStoredSession()
      }
      throw error
    }
  }

  const login = async (code: string): Promise<void> => {
    const session = await transport
      .call('auth.login', { code })
      .then((value) => verifyPhoneOutputSchema.parse(value))
    setStoredSession(session)
  }

  const logout = async (): Promise<void> => {
    const session = getStoredSession()
    if (session?.tokens.accessToken) {
      try {
        // 携带本地访问令牌：云函数模式下服务端撤销的必须是用户真实会话，而非交换新会话。
        await transport.call('auth.logout', { accessToken: session.tokens.accessToken })
      } catch {
        // 服务端退出失败不影响本地退出。
      }
    }
    clearStoredSession()
  }

  // HTTP 令牌自动刷新走同一实现。
  setSessionRefreshHandler(() => refresh())

  const ensureSession = async (): Promise<boolean> => {
    const app = getApp<{ authReady?: Promise<boolean> }>()
    if (app?.authReady) {
      return app.authReady
    }
    const pending = bootstrap()
    if (app) {
      app.authReady = pending
    }
    return pending
  }

  const bootstrap = async (): Promise<boolean> => {
    const session = getStoredSession()
    if (session && !isAccessExpired(session)) {
      return true
    }
    if (session) {
      const previousAccess = session.tokens.accessToken
      try {
        await refresh()
        return true
      } catch {
        if (keepIfReplaced(previousAccess)) {
          return true
        }
      }
    }
    const previousAccess = getStoredSession()?.tokens.accessToken
    try {
      await login(await wxLogin())
      return true
    } catch {
      return keepIfReplaced(previousAccess)
    }
  }

  function keepIfReplaced(previousAccess: string | undefined): boolean {
    const current = getStoredSession()
    if (current && current.tokens.accessToken !== previousAccess) {
      return true
    }
    if (current) {
      clearStoredSession()
    }
    return false
  }

  return {
    ensureSession,
    ensureFresh: async () => {
      const session = getStoredSession()
      if (session && isAccessExpired(session)) {
        await refresh()
      }
    },
    login,
    refresh,
    logout,
    isAuthenticated: () => Boolean(getStoredSession()?.tokens.accessToken),
  }
}
