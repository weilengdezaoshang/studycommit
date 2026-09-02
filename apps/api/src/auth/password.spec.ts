import { describe, expect, it } from 'vitest'
import { dummyPasswordHash, hashPassword, normalizeAccount, verifyPassword } from './password'

describe('password', () => {
  it('同一密码校验通过，错误密码失败', async () => {
    const stored = await hashPassword('secret123')
    await expect(verifyPassword('secret123', stored)).resolves.toBe(true)
    await expect(verifyPassword('wrong-pass', stored)).resolves.toBe(false)
  })

  it('账号规范化为小写并去掉首尾空格', () => {
    expect(normalizeAccount('  Demo_User  ')).toBe('demo_user')
  })

  it('占位哈希与真实密码哈希走同一套 scrypt 格式', async () => {
    const dummy = await dummyPasswordHash()
    expect(dummy.startsWith('scrypt$')).toBe(true)
    await expect(verifyPassword('\0studycommit-dummy-password', dummy)).resolves.toBe(true)
    await expect(verifyPassword('secret123', dummy)).resolves.toBe(false)
  })
})
