import { describe, expect, it, vi } from 'vitest'
import { createHttpError } from '../../services/http'
import { createHttpTransport, type HttpTransportRequest } from './http-transport'
import { MINIPROGRAM_OPERATIONS } from '../services/operations'

type Recorded = { request: Record<string, unknown>; access: string }

function createStubRequest(response: unknown) {
  const records: Recorded[] = []
  const request: HttpTransportRequest = vi.fn(async (raw, access) => {
    const req = raw as Record<string, unknown>
    records.push({
      request: {
        method: req.method,
        path: req.path,
        data: req.data,
        headers: req.headers,
      },
      access,
    })
    if (response instanceof Error) {
      throw response
    }
    return response as never
  })
  return { records, request }
}

describe('HttpTransport', () => {
  it('写请求映射到 REST 路由并透传幂等键', async () => {
    const { records, request } = createStubRequest({ id: 'p1' })
    const transport = createHttpTransport({ routes: MINIPROGRAM_OPERATIONS, request })
    await transport.call(
      'papers.create',
      { content: '内容', hasQuestion: false },
      { idempotencyKey: 'idem-7' },
    )
    expect(records[0]).toEqual({
      request: {
        method: 'POST',
        path: '/papers',
        data: { content: '内容', hasQuestion: false },
        headers: { 'idempotency-key': 'idem-7' },
      },
      access: 'authed',
    })
  })

  it('读请求把输入展开为查询参数且不携带请求体', async () => {
    const { records, request } = createStubRequest({ items: [] })
    const transport = createHttpTransport({ routes: MINIPROGRAM_OPERATIONS, request })
    await transport.call('papers.list', { status: 'inbox', limit: 20 })
    expect(records[0].request).toMatchObject({
      method: 'GET',
      path: '/papers?status=inbox&limit=20',
    })
    expect(records[0].request.data).toBeUndefined()
  })

  it('路径参数按输入生成', async () => {
    const { records, request } = createStubRequest({ id: 'p1', version: 1 })
    const transport = createHttpTransport({ routes: MINIPROGRAM_OPERATIONS, request })
    await transport.call('papers.remove', { id: 'p 1', version: 1 })
    expect(records[0].request).toMatchObject({
      method: 'DELETE',
      path: '/papers/p%201',
    })
  })

  it('登录等公共操作不带会话令牌', async () => {
    const { records, request } = createStubRequest({ user: {}, tokens: {} })
    const transport = createHttpTransport({ routes: MINIPROGRAM_OPERATIONS, request })
    await transport.call('auth.login', { code: 'wx' })
    expect(records[0].access).toBe('public')
  })

  it('HTTP 错误归一为统一 ServiceError', async () => {
    const httpError = createHttpError({
      code: 'UNAUTHORIZED',
      message: '登录已过期',
      status: 401,
    })
    const { request } = createStubRequest(httpError)
    const transport = createHttpTransport({ routes: MINIPROGRAM_OPERATIONS, request })
    await expect(transport.call('papers.list', {})).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('HTTP 模式不支持的云函数专属操作明确报功能关闭', async () => {
    const { request } = createStubRequest({})
    const transport = createHttpTransport({ routes: MINIPROGRAM_OPERATIONS, request })
    await expect(transport.call('uploads.attach', {})).rejects.toMatchObject({
      code: 'SERVICE_DISABLED',
    })
    await expect(transport.call('not.an.operation', {})).rejects.toMatchObject({
      code: 'SERVICE_DISABLED',
    })
  })
})
