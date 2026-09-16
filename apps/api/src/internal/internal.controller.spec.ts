import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { InternalController } from './internal.controller'
import { InternalService } from './internal.service'

function createController() {
  const exchanged: Array<{ openId: string; unionId?: string }> = []
  const service = {
    exchangeMiniprogramIdentity: async (input: { openId: string; unionId?: string }) => {
      exchanged.push(input)
      return {
        user: { id: 'user-1' },
        tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2026-09-16T00:00:00.000Z' },
      }
    },
  } as unknown as InternalService
  return { controller: new InternalController(service), exchanged }
}

describe('InternalController 身份交换入参校验', () => {
  it('合法入参透传给服务并包装 data 返回', async () => {
    const { controller, exchanged } = createController()
    const result = await controller.exchange({ openId: ' openid-1 ' })
    expect(exchanged).toEqual([{ openId: 'openid-1' }])
    expect(result.data.tokens.accessToken).toBe('a')
  })

  it('缺少 openId 或类型不符时返回 400 而不触达服务', async () => {
    const { controller, exchanged } = createController()
    await expect(controller.exchange({})).rejects.toMatchObject({
      status: 400,
    })
    await expect(controller.exchange({ openId: 123 })).rejects.toBeInstanceOf(BadRequestException)
    expect(exchanged).toHaveLength(0)
  })
})
