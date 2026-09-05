import { describe, expect, it, vi } from 'vitest'
import { createApiOrpcClient } from './client'

describe('createApiOrpcClient', () => {
  it('通过 OpenAPI Link 发送箱子请求并合并鉴权头', async () => {
    const remoteTopic = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      name: '系统设计',
      description: null,
      color: '#DCE9D8',
      templateId: crypto.randomUUID(),
      template: { id: crypto.randomUUID(), name: '空白', icon: 'box', paperBackground: 'plain' },
      status: 'active' as const,
      totalDurationSeconds: 0,
      paperCount: 0,
      lastPaperAt: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    }
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            items: [remoteTopic],
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )
    const client = createApiOrpcClient({
      origin: 'https://api.example.com',
      apiPrefix: '/api',
      fetchImpl: fetchImpl as typeof fetch,
      getHeaders: async () => ({ authorization: 'Bearer access-token' }),
    })

    await client.topics.list({ status: 'active', limit: 20 }, { context: {} })

    const request = fetchImpl.mock.calls[0]?.[0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).url).toBe(
      'https://api.example.com/api/topics?status=active&limit=20',
    )
    expect((request as Request).headers.get('authorization')).toBe('Bearer access-token')
  })

  it('上下文携带幂等键时写入 idempotency-key 请求头', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(JSON.stringify({ id: crypto.randomUUID(), account: '学习者' }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const client = createApiOrpcClient({
      origin: 'https://api.example.com',
      apiPrefix: '/api',
      fetchImpl: fetchImpl as typeof fetch,
      getHeaders: async () => ({}),
    })

    await client.auth.registerAccount(
      { account: '学习者', password: 'password-123' },
      { context: { idempotencyKey: 'register-key' } },
    )

    const request = fetchImpl.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('https://api.example.com/api/auth/account/register')
    expect(request.headers.get('idempotency-key')).toBe('register-key')
  })
})
