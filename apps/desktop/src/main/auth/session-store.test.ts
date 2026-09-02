// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createHttpError } from '@studycommit/common/http'
import {
  createMemorySessionPersist,
  DesktopAuthSessionStore,
  isAccessExpired,
} from './session-store'
import type { DesktopPersistedSession } from './session-store'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/studycommit-test' },
  safeStorage: { isEncryptionAvailable: () => false },
}))

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const past = new Date(Date.now() - 1000).toISOString()

const session: DesktopPersistedSession = {
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

describe('DesktopAuthSessionStore', () => {
  it('登录后的请求带上 Bearer，临期会先刷新', async () => {
    const store = new DesktopAuthSessionStore(createMemorySessionPersist())
    store.setSession(session)
    await expect(store.authorizationHeaders()).resolves.toEqual({
      authorization: 'Bearer access',
    })

    const refresh = vi.fn().mockResolvedValue({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
      expiresAt: future,
    })
    store.bindRefresh(refresh)
    store.setSession({ ...session, tokens: { ...session.tokens, expiresAt: past } })
    await expect(store.authorizationHeaders()).resolves.toEqual({
      authorization: 'Bearer next-access',
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('刷新令牌失效时清掉会话，网络错误则保留', async () => {
    const store = new DesktopAuthSessionStore(createMemorySessionPersist())
    store.setSession({ ...session, tokens: { ...session.tokens, expiresAt: past } })
    store.bindRefresh(async () => {
      throw createHttpError({ code: 'UNAUTHORIZED', message: '未登录', status: 401 })
    })
    await expect(store.authorizationHeaders()).resolves.toEqual({})
    expect(store.getSession()).toBeNull()

    const kept = new DesktopAuthSessionStore(createMemorySessionPersist())
    kept.setSession({ ...session, tokens: { ...session.tokens, expiresAt: past } })
    kept.bindRefresh(async () => {
      throw createHttpError({ code: 'NETWORK_ERROR', message: '网络异常' })
    })
    await expect(kept.authorizationHeaders()).resolves.toEqual({
      authorization: 'Bearer access',
    })
    expect(kept.getSession()?.tokens.accessToken).toBe('access')
  })

  it('过期判断包含 30 秒偏斜', () => {
    expect(isAccessExpired(session)).toBe(false)
    expect(isAccessExpired({ ...session, tokens: { ...session.tokens, expiresAt: past } })).toBe(
      true,
    )
  })

  it('临期并发请求只刷新一次，并都拿到新令牌', async () => {
    const store = new DesktopAuthSessionStore(createMemorySessionPersist())
    store.setSession({ ...session, tokens: { ...session.tokens, expiresAt: past } })
    let release: (tokens: DesktopPersistedSession['tokens']) => void = () => undefined
    const refresh = vi.fn().mockImplementation(
      () =>
        new Promise<DesktopPersistedSession['tokens']>((resolve) => {
          release = resolve
        }),
    )
    store.bindRefresh(refresh)
    const first = store.authorizationHeaders()
    const second = store.authorizationHeaders()
    release({ accessToken: 'next-access', refreshToken: 'next-refresh', expiresAt: future })
    await expect(Promise.all([first, second])).resolves.toEqual([
      { authorization: 'Bearer next-access' },
      { authorization: 'Bearer next-access' },
    ])
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
