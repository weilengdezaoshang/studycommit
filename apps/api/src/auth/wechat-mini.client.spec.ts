import { BadRequestException, HttpException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { AUTH_ERROR } from './auth.constants'
import { parseStubSession, WechatMiniClient } from './wechat-mini.client'

describe('WechatMiniClient', () => {
  it('开发桩把 code 解析为 openid 和可选 unionid', () => {
    expect(parseStubSession('openid-aaa')).toEqual({ openid: 'openid-aaa', unionid: null })
    expect(parseStubSession('openid-ccc|union-1')).toEqual({
      openid: 'openid-ccc',
      unionid: 'union-1',
    })
  })

  it('未配置小程序密钥时拒绝真实换票', async () => {
    const client = new WechatMiniClient({ get: vi.fn().mockReturnValue(undefined) } as never)
    await expect(client.exchangeCode('wxcode')).rejects.toBeInstanceOf(HttpException)
    await expect(client.exchangeCode('wxcode')).rejects.toMatchObject({
      response: { code: AUTH_ERROR.wechatUnavailable.code },
    })
  })

  it('微信返回错误码时视为登录码无效', async () => {
    const client = new WechatMiniClient({
      get: vi.fn((key: string) =>
        key === 'WECHAT_MINI_APP_ID'
          ? 'wx123'
          : key === 'WECHAT_MINI_APP_SECRET'
            ? 'secret'
            : undefined,
      ),
    } as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ errcode: 40029, errmsg: 'invalid code' }),
      }),
    )
    await expect(client.exchangeCode('used')).rejects.toBeInstanceOf(BadRequestException)
    vi.unstubAllGlobals()
  })
})
