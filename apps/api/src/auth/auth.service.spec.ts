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

  it('账号已存在时拒绝注册', async () => {
    const repository = {
      findIdentity: vi.fn().mockResolvedValue({ userId: crypto.randomUUID() }),
    }
    const service = new AuthService(
      repository as never,
      {} as never,
      { get: vi.fn() } as never,
      {} as never,
    )
    await expect(
      service.registerAccount({ account: 'demo', password: 'secret123' }),
    ).rejects.toMatchObject({ response: { code: AUTH_ERROR.accountExists.code } })
  })

  it('注册时携带昵称则以昵称创建用户', async () => {
    const repository = {
      findIdentity: vi.fn().mockResolvedValue(null),
      createAccountUser: vi
        .fn()
        .mockResolvedValue({ id: crypto.randomUUID(), nickname: '学习者小明' }),
    }
    const service = new AuthService(
      repository as never,
      {} as never,
      { get: vi.fn() } as never,
      {} as never,
    )
    await service.registerAccount({
      account: 'demo',
      password: 'secret123',
      nickname: '学习者小明',
    })
    expect(repository.createAccountUser).toHaveBeenCalledWith(
      'demo',
      expect.any(String),
      '学习者小明',
    )
  })

  it('账号密码错误时返回固定错误码', async () => {
    const repository = {
      findIdentity: vi.fn().mockResolvedValue({
        userId: crypto.randomUUID(),
        passwordHash: 'scrypt$invalid$invalid',
      }),
    }
    const service = new AuthService(
      repository as never,
      {} as never,
      { get: vi.fn() } as never,
      {} as never,
    )
    await expect(
      service.loginAccount({ account: 'demo', password: 'wrong-password', deviceType: 'desktop' }),
    ).rejects.toMatchObject({ response: { code: AUTH_ERROR.invalidCredentials.code } })
  })

  it('未注册账号登录失败且不自动创建用户', async () => {
    const repository = {
      findIdentity: vi.fn().mockResolvedValue(null),
      createAccountUser: vi.fn(),
    }
    const service = new AuthService(
      repository as never,
      {} as never,
      { get: vi.fn() } as never,
      {} as never,
    )
    await expect(
      service.loginAccount({ account: 'demo', password: 'secret123', deviceType: 'desktop' }),
    ).rejects.toMatchObject({ response: { code: AUTH_ERROR.invalidCredentials.code } })
    expect(repository.createAccountUser).not.toHaveBeenCalled()
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
