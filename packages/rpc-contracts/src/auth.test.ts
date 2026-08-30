import { describe, expect, it } from 'vitest'
import {
  sendPhoneCodeInputSchema,
  verifyPhoneInputSchema,
  verifyPhoneOutputSchema,
  wechatMiniprogramLoginInputSchema,
} from './auth.js'

describe('phone auth contract', () => {
  it('只接受十一位中国大陆手机号和六位验证码', () => {
    expect(sendPhoneCodeInputSchema.parse({ phone: '13800138000' })).toEqual({
      phone: '13800138000',
    })
    expect(sendPhoneCodeInputSchema.safeParse({ phone: '1380013800' }).success).toBe(false)
    expect(
      verifyPhoneInputSchema.parse({
        phone: '13800138000',
        code: '123456',
        deviceType: 'mobile',
      }),
    ).toMatchObject({ deviceType: 'mobile' })
    expect(
      verifyPhoneInputSchema.safeParse({
        phone: '13800138000',
        code: '12345',
        deviceType: 'mobile',
      }).success,
    ).toBe(false)
  })

  it('验证成功后返回用户与令牌而不回传手机号', () => {
    const now = new Date().toISOString()
    const parsed = verifyPhoneOutputSchema.parse({
      user: {
        id: crypto.randomUUID(),
        nickname: '学习者',
        avatarUrl: null,
        status: 'active',
      },
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: now,
      },
    })
    expect(parsed.user).not.toHaveProperty('phone')
  })

  it('小程序登录只接受微信登录码', () => {
    expect(wechatMiniprogramLoginInputSchema.parse({ code: '  wxcode  ' })).toEqual({
      code: 'wxcode',
    })
    expect(wechatMiniprogramLoginInputSchema.safeParse({ code: '' }).success).toBe(false)
    expect(wechatMiniprogramLoginInputSchema.safeParse({ code: 'a'.repeat(129) }).success).toBe(
      false,
    )
  })
})
