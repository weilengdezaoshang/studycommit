const mockSecureStore = new Map<string, string>()

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value)
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key)
  }),
}))

jest.mock('../config/api-config', () => ({
  getMobileApiOrigin: () => 'http://localhost:3000',
  getMobileApiPrefix: () => '/api',
}))

import * as SecureStore from 'expo-secure-store'
import {
  clearAuthSession,
  getAuthHeaders,
  getAuthGate,
  hydrateAuthSession,
  setAuthSession,
} from './session-store'

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  nickname: '测试',
  avatarUrl: null,
  status: 'active' as const,
}

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const past = new Date(Date.now() - 60 * 1000).toISOString()

describe('session-store', () => {
  const originalFetch = globalThis.fetch
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  beforeEach(async () => {
    await hydrateAuthSession()
  })

  afterEach(() => {
    clearAuthSession()
    mockSecureStore.clear()
    globalThis.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('退出登录时删除安全存储中的会话', async () => {
    setAuthSession({
      user,
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: future },
    })
    await flush()
    expect(mockSecureStore.size).toBe(1)
    clearAuthSession()
    await flush()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled()
    expect(mockSecureStore.size).toBe(0)
    expect(getAuthGate().session).toBeNull()
  })

  it('刷新成功后使用接口顶层令牌续期', async () => {
    setAuthSession({
      user,
      tokens: { accessToken: 'old', refreshToken: 'refresh-old', expiresAt: past },
    })
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: future,
      }),
    }) as typeof fetch

    await expect(getAuthHeaders()).resolves.toEqual({ authorization: 'Bearer new-access' })
    expect(getAuthGate().session?.tokens).toMatchObject({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/token/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'refresh-old' }),
      }),
    )
  })

  it('重复水合不会覆盖已登录会话', async () => {
    setAuthSession({
      user,
      tokens: { accessToken: 'live', refreshToken: 'r', expiresAt: future },
    })
    await hydrateAuthSession()
    expect(getAuthGate().session?.tokens.accessToken).toBe('live')
  })
})
