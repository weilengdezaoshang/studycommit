import { afterEach, describe, expect, it, vi } from 'vitest'
import { ServiceError } from '../../shared/service-runtime/index'
import { createAuthService, type AuthService } from './auth-service'
import {
  configureAuthStorage,
  getStoredSession,
  resetAuthStorage,
  setStoredSession,
} from '../../services/auth-session'
import type { AuthSession } from '../../services/auth-session'
import type { MiniprogramTransport } from '../transport/transport.types'

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

type RecordedCall = { operation: string; input?: unknown }

function createFakeTransport() {
  const call = vi.fn((operation: string) => Promise.reject(new Error(`未配置的调用 ${operation}`)))
  const transport = { call } as unknown as MiniprogramTransport
  const getCalls = (): RecordedCall[] =>
    call.mock.calls.map((argumentsList) => ({ operation: argumentsList[0] as string }))
  return { getCalls, transport, call }
}

function createService(
  transport: MiniprogramTransport,
  wxLogin?: () => Promise<string>,
): AuthService {
  return createAuthService({ transport, ...(wxLogin ? { wxLogin } : {}) })
}

describe('auth-service 会话引导', () => {
  afterEach(() => {
    memory.clear()
    resetAuthStorage()
    vi.unstubAllGlobals()
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
    vi.stubGlobal('getApp', () => ({}))
    setStoredSession(session)
    const { transport, getCalls } = createFakeTransport()
    const service = createService(transport, vi.fn())
    await expect(service.ensureSession()).resolves.toBe(true)
    expect(getCalls()).toHaveLength(0)
  })

  it('访问令牌过期时先刷新再沿用会话', async () => {
    useMemory()
    vi.stubGlobal('getApp', () => ({}))
    setStoredSession({
      ...session,
      tokens: { ...session.tokens, expiresAt: new Date(Date.now() - 1000).toISOString() },
    })
    const { transport, getCalls, call } = createFakeTransport()
    call.mockImplementation(((operation: string) => {
      if (operation === 'auth.refresh') {
        return Promise.resolve({
          accessToken: 'refreshed',
          refreshToken: 'refresh-2',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
      }
      return Promise.reject(new Error('不应登录'))
    }) as never)
    const service = createService(transport, vi.fn())
    await expect(service.ensureSession()).resolves.toBe(true)
    expect(getCalls().map((entry) => entry.operation)).toEqual(['auth.refresh'])
    expect(getStoredSession()?.tokens.accessToken).toBe('refreshed')
  })

  it('没有会话时用微信登录码换取账户', async () => {
    useMemory()
    vi.stubGlobal('getApp', () => ({}))
    const wxLogin = vi.fn().mockResolvedValue('wxcode')
    const { transport, getCalls, call } = createFakeTransport()
    call.mockImplementation(((operation: string) => {
      if (operation === 'auth.login') {
        return Promise.resolve(session)
      }
      return Promise.reject(new Error('不应刷新'))
    }) as never)
    const service = createService(transport, wxLogin)
    await expect(service.ensureSession()).resolves.toBe(true)
    expect(wxLogin).toHaveBeenCalledTimes(1)
    expect(getCalls()).toHaveLength(1)
    expect(getCalls()[0]).toMatchObject({ operation: 'auth.login' })
  })

  it('微信登录失败时清除会话并返回未登录', async () => {
    useMemory()
    vi.stubGlobal('getApp', () => ({}))
    const { transport } = createFakeTransport()
    const service = createService(transport, vi.fn().mockRejectedValue(new Error('fail')))
    await expect(service.ensureSession()).resolves.toBe(false)
    expect(getStoredSession()).toBeNull()
  })

  it('静默登录失败时保留并发写入的新会话', async () => {
    useMemory()
    vi.stubGlobal('getApp', () => ({}))
    const { transport, call } = createFakeTransport()
    call.mockImplementation(((operation: string) => {
      if (operation === 'auth.login') {
        setStoredSession({
          ...session,
          tokens: { ...session.tokens, accessToken: 'from-page' },
        })
        return Promise.reject(new Error('code invalid'))
      }
      return Promise.reject(new Error('不应刷新'))
    }) as never)
    const service = createService(transport, vi.fn().mockResolvedValue('wxcode'))
    await expect(service.ensureSession()).resolves.toBe(true)
    expect(getStoredSession()?.tokens.accessToken).toBe('from-page')
  })

  it('刷新失败时保留并发登录写入的会话', async () => {
    useMemory()
    vi.stubGlobal('getApp', () => ({}))
    setStoredSession({
      ...session,
      tokens: { ...session.tokens, expiresAt: new Date(Date.now() - 1000).toISOString() },
    })
    const { transport, getCalls, call } = createFakeTransport()
    call.mockImplementation(((operation: string) => {
      if (operation === 'auth.refresh') {
        setStoredSession({
          ...session,
          tokens: { ...session.tokens, accessToken: 'from-page' },
        })
        return Promise.reject(new Error('刷新失败'))
      }
      return Promise.reject(new Error('不应登录'))
    }) as never)
    const service = createService(transport, vi.fn())
    await expect(service.ensureSession()).resolves.toBe(true)
    expect(getCalls().map((entry) => entry.operation)).toEqual(['auth.refresh'])
    expect(getStoredSession()?.tokens.accessToken).toBe('from-page')
  })

  it('退出登录携带本地访问令牌并清空会话', async () => {
    useMemory()
    setStoredSession(session)
    const { transport, call } = createFakeTransport()
    call.mockImplementation(((operation: string) => {
      if (operation === 'auth.logout') {
        return Promise.resolve({})
      }
      return Promise.reject(new Error('不应调用其他操作'))
    }) as never)
    const service = createService(transport)
    await service.logout()
    expect(getStoredSession()).toBeNull()
    const logoutCall = call.mock.calls[0] as unknown as [string, { accessToken: string }]
    expect(logoutCall[0]).toBe('auth.logout')
    // 云函数模式需要本地令牌才能撤销真实会话，而不是交换出来的新会话。
    expect(logoutCall[1]).toEqual({ accessToken: 'access' })
  })

  it('刷新返回未认证时清除本地会话', async () => {
    useMemory()
    setStoredSession(session)
    const { transport, call } = createFakeTransport()
    call.mockImplementation((() =>
      Promise.reject(
        new ServiceError({ code: 'UNAUTHENTICATED', message: '会话失效', retryable: false }),
      )) as never)
    const service = createService(transport)
    await expect(service.refresh()).rejects.toThrow()
    expect(getStoredSession()).toBeNull()
  })
})
