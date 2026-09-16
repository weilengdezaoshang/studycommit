import { describe, expect, it } from 'vitest'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { createHash, createHmac } from 'node:crypto'
import { InternalAuthGuard } from './internal-auth.guard'

const SECRET = 'test-internal-secret'

function createGuard(secret?: string): CanActivate {
  const config = {
    get: (key: string) => (key === 'INTERNAL_API_SIGNING_SECRET' ? secret : undefined),
  } as unknown as ConfigService
  return new InternalAuthGuard(config)
}

function createContext(body: unknown, headers: Record<string, string>): ExecutionContext {
  const request = { headers, body }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

function signedHeaders(body: unknown, timestamp = Date.now(), secret = SECRET) {
  const bodyDigest = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  return {
    'x-internal-timestamp': String(timestamp),
    'x-internal-signature': createHmac('sha256', secret)
      .update(`${timestamp}\n${bodyDigest}`)
      .digest('hex'),
  }
}

describe('InternalAuthGuard 内部签名守卫', () => {
  const body = { openId: 'openid-1' }

  it('未配置密钥时内部接口整体禁用', () => {
    const guard = createGuard(undefined)
    expect(() => guard.canActivate(createContext(body, signedHeaders(body)))).toThrow(
      '内部接口未启用',
    )
  })

  it('缺少签名头时拒绝', () => {
    const guard = createGuard(SECRET)
    expect(() => guard.canActivate(createContext(body, {}))).toThrow('缺少内部签名')
  })

  it('时间戳超出防重放窗口时拒绝', () => {
    const guard = createGuard(SECRET)
    const stale = signedHeaders(body, Date.now() - 10 * 60 * 1000)
    expect(() => guard.canActivate(createContext(body, stale))).toThrow('内部签名已过期')
  })

  it('签名与密钥或请求体不匹配时拒绝', () => {
    const guard = createGuard(SECRET)
    const mismatched = signedHeaders({ openId: 'openid-2' })
    expect(() => guard.canActivate(createContext(body, mismatched))).toThrow('内部签名不匹配')
    const wrongSecret = signedHeaders(body, Date.now(), 'other-secret')
    expect(() => guard.canActivate(createContext(body, wrongSecret))).toThrow('内部签名不匹配')
  })

  it('合法签名放行请求', () => {
    const guard = createGuard(SECRET)
    expect(guard.canActivate(createContext(body, signedHeaders(body)))).toBe(true)
  })
})
