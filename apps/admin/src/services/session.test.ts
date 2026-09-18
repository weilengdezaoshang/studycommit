import { describe, expect, it } from 'vitest'
import { clearSession, getSession, setSession } from './session'

describe('会话存储', () => {
  it('令牌只保存在内存，不写入 localStorage', () => {
    localStorage.clear()
    setSession({
      userId: '11111111-1111-4111-8111-111111111111',
      role: 'operator',
      accessToken: 'secret-token',
    })
    expect(getSession()?.accessToken).toBe('secret-token')
    expect(localStorage.length).toBe(0)
    expect(localStorage.getItem('accessToken')).toBeNull()
    clearSession()
    expect(getSession()).toBeNull()
  })
})
