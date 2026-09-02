import type { AuthTokens, CurrentUser } from '@studycommit/rpc-contracts/auth'

export type AuthSession = { user: CurrentUser; tokens: AuthTokens }

const SESSION_KEY = 'studycommit.auth.session.v1'
const REFRESH_SKEW_MS = 30_000

export type AuthStorage = {
  getItem(key: string): string | undefined
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const wxStorage: AuthStorage = {
  getItem(key) {
    const value = wx.getStorageSync(key)
    return typeof value === 'string' && value.length > 0 ? value : undefined
  },
  setItem(key, value) {
    wx.setStorageSync(key, value)
  },
  removeItem(key) {
    wx.removeStorageSync(key)
  },
}

let storage: AuthStorage = wxStorage
let refreshHandler: (() => Promise<void>) | null = null
let refreshing: Promise<boolean> | null = null

export function configureAuthStorage(next: AuthStorage) {
  storage = next
}

export function setSessionRefreshHandler(handler: () => Promise<void>) {
  refreshHandler = handler
}

export function resetAuthStorage() {
  storage = wxStorage
  refreshing = null
}

export function getStoredSession(): AuthSession | null {
  const raw = storage.getItem(SESSION_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as AuthSession
    if (parsed?.user?.id && parsed.tokens?.accessToken && parsed.tokens.refreshToken) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

export function setStoredSession(session: AuthSession) {
  storage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  storage.removeItem(SESSION_KEY)
}

export function getAccessToken(): string | undefined {
  return getStoredSession()?.tokens.accessToken
}

export function isAccessExpired(session = getStoredSession()): boolean {
  if (!session) {
    return true
  }
  const expiresAt = Date.parse(session.tokens.expiresAt)
  return Number.isNaN(expiresAt) || expiresAt - Date.now() <= REFRESH_SKEW_MS
}

export async function ensureFreshSession(): Promise<boolean> {
  const current = getStoredSession()
  if (!current) {
    return false
  }
  if (!isAccessExpired(current)) {
    return true
  }
  if (!refreshHandler) {
    return false
  }
  if (!refreshing) {
    refreshing = (async () => {
      try {
        await refreshHandler?.()
        return Boolean(getAccessToken())
      } catch {
        return Boolean(getAccessToken())
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}
