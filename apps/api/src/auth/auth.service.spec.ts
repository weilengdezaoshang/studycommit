import { BadRequestException, HttpException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { AUTH_ERROR } from './auth.constants'
import { AuthService } from './auth.service'

const phone = '13800138000'

describe('AuthService', () => {
  it('冷却期内拒绝重复发送验证码', async () => {
    const redis = { setNxEx: vi.fn().mockResolvedValue(false) }
    const service = new AuthService(
      {} as never,
      redis as never,
      { get: vi.fn() } as never,
      {} as never,
    )
    await expect(service.sendPhoneCode(phone)).rejects.toMatchObject({
      response: { code: AUTH_ERROR.codeCooldown.code },
    })
    await expect(service.sendPhoneCode(phone)).rejects.toBeInstanceOf(HttpException)
  })

  it('验证码错误与缺失分别返回固定错误码', async () => {
    const redis = {
      evalNumber: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
    }
    const service = new AuthService(
      {} as never,
      redis as never,
      { get: vi.fn() } as never,
      {} as never,
    )
    await expect(
      service.verifyPhone({ phone, code: '000000', deviceType: 'mobile' }),
    ).rejects.toMatchObject({ response: { code: AUTH_ERROR.codeInvalid.code } })
    await expect(
      service.verifyPhone({ phone, code: '123456', deviceType: 'mobile' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('微信登录码无效时返回固定错误码', async () => {
    const wechat = {
      exchangeCode: vi
        .fn()
        .mockRejectedValue(new BadRequestException(AUTH_ERROR.wechatCodeInvalid)),
    }
    const service = new AuthService(
      {} as never,
      {} as never,
      { get: vi.fn() } as never,
      wechat as never,
    )
    await expect(service.loginWechatMiniprogram('bad-code')).rejects.toMatchObject({
      response: { code: AUTH_ERROR.wechatCodeInvalid.code },
    })
  })
})
