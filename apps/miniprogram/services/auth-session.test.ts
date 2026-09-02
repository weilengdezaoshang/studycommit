import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredSession,
  configureAuthStorage,
  ensureFreshSession,
  getAccessToken,
  getStoredSession,
  isAccessExpired,
  resetAuthStorage,
  setSessionRefreshHandler,
  setStoredSession,
} from './auth-session'
import type { AuthSession } from './auth-session'

const memory = new Map<string, string>()

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const past = new Date(Date.now() - 60 * 1000).toISOString()

const session: AuthSession = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    nickname: '学习者',
    avatarUrl: null,
    status: 'active',
  },
  tokens: {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: future,
  },
}

describe('auth-session', () => {
  afterEach(() => {
    memory.clear()
    resetAuthStorage()
  })

  it('读写并清理本地会话', () => {
    configureAuthStorage({
      getItem: (key) => memory.get(key),
      setItem: (key, value) => {
        memory.set(key, value)
      },
      removeItem: (key) => {
        memory.delete(key)
      },
    })
    setStoredSession(session)
    expect(getStoredSession()).toEqual(session)
    expect(getAccessToken()).toBe('access')
    clearStoredSession()
    expect(getStoredSession()).toBeNull()
    expect(getAccessToken()).toBeUndefined()
  })

  it('访问令牌过期或缺失视为需要续期', () => {
    expect(isAccessExpired(null)).toBe(true)
    expect(isAccessExpired(session)).toBe(false)
    expect(isAccessExpired({ ...session, tokens: { ...session.tokens, expiresAt: past } })).toBe(
      true,
    )
  })

  function useMemory() {
    configureAuthStorage({
      getItem: (key) => memory.get(key),
      setItem: (key, value) => {
        memory.set(key, value)
      },
      removeItem: (key) => {
        memory.delete(key)
      },
    })
  }

  it('临期访问令牌并发续期只刷新一次', async () => {
    useMemory()
    setStoredSession({ ...session, tokens: { ...session.tokens, expiresAt: past } })
    const refresh = vi.fn().mockImplementation(async () => {
      setStoredSession({
        ...session,
        tokens: { ...session.tokens, accessToken: 'new-access', expiresAt: future },
      })
    })
    setSessionRefreshHandler(refresh)
    const [first, second] = await Promise.all([ensureFreshSession(), ensureFreshSession()])
    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe('new-access')
  })

  it('刷新失败且会话已清除时视为未登录', async () => {
    useMemory()
    setStoredSession({ ...session, tokens: { ...session.tokens, expiresAt: past } })
    setSessionRefreshHandler(async () => {
      clearStoredSession()
      throw new Error('UNAUTHORIZED')
    })
    await expect(ensureFreshSession()).resolves.toBe(false)
    expect(getStoredSession()).toBeNull()
  })

  it('刷新网络失败时保留当前会话', async () => {
    useMemory()
    setStoredSession({ ...session, tokens: { ...session.tokens, expiresAt: past } })
    setSessionRefreshHandler(async () => {
      throw new Error('NETWORK_ERROR')
    })
    await expect(ensureFreshSession()).resolves.toBe(true)
    expect(getAccessToken()).toBe('access')
  })
})
