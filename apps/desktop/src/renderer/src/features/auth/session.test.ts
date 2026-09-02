import { describe, expect, it } from 'vitest'
import { clearAuthSession, getSessionSnapshot, setAuthSession } from './session'

describe('desktop auth session', () => {
  it('渲染进程不把令牌写入 localStorage', () => {
    setAuthSession({
      user: { id: 'u1', nickname: 'n', avatarUrl: null, status: 'active' },
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2026-12-31T00:00:00.000Z' },
    })
    const stored = JSON.parse(
      window.localStorage.getItem('studycommit.desktop.auth.session.v1') ?? '{}',
    ) as Record<string, unknown>
    expect(stored).toEqual({
      user: { id: 'u1', nickname: 'n', avatarUrl: null, status: 'active' },
    })
    expect(stored).not.toHaveProperty('tokens')
    expect(getSessionSnapshot()).toEqual({
      user: { id: 'u1', nickname: 'n', avatarUrl: null, status: 'active' },
    })
    clearAuthSession()
    expect(getSessionSnapshot()).toBeNull()
  })
})
