import { loginWechatMiniprogram, refreshAuthSession } from './auth-api'
import { clearStoredSession, getStoredSession, isAccessExpired } from './auth-session'

export type WxLogin = () => Promise<string>

const wxLogin: WxLogin = () =>
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

export async function waitForMiniprogramAuth(): Promise<boolean> {
  const app = getApp<{ authReady?: Promise<boolean> }>()
  if (app.authReady) {
    return app.authReady
  }
  const pending = bootstrapMiniprogramAuth()
  app.authReady = pending
  return pending
}

export async function bootstrapMiniprogramAuth(options?: {
  login?: WxLogin
  signIn?: (code: string) => Promise<void>
  refresh?: () => Promise<void>
}): Promise<boolean> {
  const login = options?.login ?? wxLogin
  const signIn = options?.signIn ?? loginWechatMiniprogram
  const refresh = options?.refresh ?? refreshAuthSession
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
    await signIn(await login())
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
