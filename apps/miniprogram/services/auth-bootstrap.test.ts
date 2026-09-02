import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootstrapMiniprogramAuth } from './auth-bootstrap'
import {
  configureAuthStorage,
  getStoredSession,
  resetAuthStorage,
  setStoredSession,
} from './auth-session'
import type { AuthSession } from './auth-session'

const memory = new Map<string, string>()

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
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  },
}

describe('bootstrapMiniprogramAuth', () => {
  afterEach(() => {
    memory.clear()
    resetAuthStorage()
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

  it('已有未过期会话时直接视为已登录', async () => {
    useMemory()
    setStoredSession(session)
    const login = vi.fn()
    await expect(bootstrapMiniprogramAuth({ login })).resolves.toBe(true)
    expect(login).not.toHaveBeenCalled()
  })

  it('访问令牌过期时先刷新再沿用会话', async () => {
    useMemory()
    setStoredSession({
      ...session,
      tokens: { ...session.tokens, expiresAt: new Date(Date.now() - 1000).toISOString() },
    })
    const refresh = vi.fn().mockResolvedValue(undefined)
    const login = vi.fn()
    await expect(bootstrapMiniprogramAuth({ login, refresh })).resolves.toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(login).not.toHaveBeenCalled()
  })

  it('没有会话时用微信登录码换取账户', async () => {
    useMemory()
    const login = vi.fn().mockResolvedValue('wxcode')
    const signIn = vi.fn().mockImplementation(async () => {
      setStoredSession(session)
    })
    await expect(bootstrapMiniprogramAuth({ login, signIn })).resolves.toBe(true)
    expect(login).toHaveBeenCalledTimes(1)
    expect(signIn).toHaveBeenCalledWith('wxcode')
  })

  it('微信登录失败时清除会话并返回未登录', async () => {
    useMemory()
    const login = vi.fn().mockRejectedValue(new Error('fail'))
    await expect(bootstrapMiniprogramAuth({ login })).resolves.toBe(false)
    expect(getStoredSession()).toBeNull()
  })

  it('静默登录失败时保留并发写入的新会话', async () => {
    useMemory()
    const login = vi.fn().mockResolvedValue('wxcode')
    const signIn = vi.fn().mockImplementation(async () => {
      setStoredSession({
        ...session,
        tokens: { ...session.tokens, accessToken: 'from-page' },
      })
      throw new Error('code invalid')
    })
    await expect(bootstrapMiniprogramAuth({ login, signIn })).resolves.toBe(true)
    expect(getStoredSession()?.tokens.accessToken).toBe('from-page')
  })

  it('刷新失败时保留并发登录写入的会话', async () => {
    useMemory()
    setStoredSession({
      ...session,
      tokens: { ...session.tokens, expiresAt: new Date(Date.now() - 1000).toISOString() },
    })
    const refresh = vi.fn().mockImplementation(async () => {
      setStoredSession({
        ...session,
        tokens: { ...session.tokens, accessToken: 'from-page' },
      })
      throw new Error('UNAUTHORIZED')
    })
    const login = vi.fn()
    await expect(bootstrapMiniprogramAuth({ login, refresh })).resolves.toBe(true)
    expect(login).not.toHaveBeenCalled()
    expect(getStoredSession()?.tokens.accessToken).toBe('from-page')
  })
})
