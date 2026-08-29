import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { AUTH_ERROR } from './auth.constants'
import { IdentityGuard } from './identity.guard'

const userId = '11111111-1111-4111-8111-111111111111'

function contextWith(headers: Record<string, string>) {
  const request = { headers, userId: undefined as string | undefined }
  return {
    request,
    switchToHttp: () => ({ getRequest: () => request }),
  }
}

describe('IdentityGuard', () => {
  it('优先使用登录令牌且忽略开发用户头', async () => {
    const auth = {
      requireAccess: vi.fn().mockResolvedValue({
        userId: '22222222-2222-4222-8222-222222222222',
        sessionId: '33333333-3333-4333-8333-333333333333',
      }),
    }
    const guard = new IdentityGuard(auth as never, { get: () => 'test' } as never)
    const ctx = contextWith({
      authorization: 'Bearer access-token',
      'x-user-id': userId,
    })
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true)
    expect(ctx.request.userId).toBe('22222222-2222-4222-8222-222222222222')
    expect(auth.requireAccess).toHaveBeenCalledWith('access-token')
  })

  it('测试环境无令牌时允许开发用户头', async () => {
    const guard = new IdentityGuard(
      { requireAccess: vi.fn() } as never,
      { get: () => 'test' } as never,
    )
    const ctx = contextWith({ 'x-user-id': userId })
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true)
    expect(ctx.request.userId).toBe(userId)
  })

  it('生产环境不接受开发用户头', async () => {
    const guard = new IdentityGuard(
      { requireAccess: vi.fn() } as never,
      { get: () => 'production' } as never,
    )
    await expect(
      guard.canActivate(contextWith({ 'x-user-id': userId }) as never),
    ).rejects.toMatchObject({
      response: { code: AUTH_ERROR.unauthenticated.code },
    })
  })

  it('无效令牌即使带有开发用户头也拒绝', async () => {
    const guard = new IdentityGuard(
      {
        requireAccess: vi
          .fn()
          .mockRejectedValue(new UnauthorizedException(AUTH_ERROR.unauthenticated)),
      } as never,
      { get: () => 'test' } as never,
    )
    await expect(
      guard.canActivate(contextWith({ authorization: 'Bearer bad', 'x-user-id': userId }) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
