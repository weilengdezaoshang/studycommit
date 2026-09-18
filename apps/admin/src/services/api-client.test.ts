import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminApiError, AdminClient, toQuery } from './api-client'
import { buildAccountLoginBody, validateLoginForm } from './login'
import { runCommand } from './command'

describe('管理端 API 客户端', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('oRPC 层错误被解析为统一 AdminApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'CAMPAIGN_VERSION_CONFLICT', message: '版本已变化' }), {
          status: 409,
        }),
      ),
    )
    const client = new AdminClient({ baseUrl: '', getToken: () => 'token' })
    const error = (await client.request('POST', '/x').catch((e: unknown) => e)) as AdminApiError
    expect(error).toBeInstanceOf(AdminApiError)
    expect(error.code).toBe('CAMPAIGN_VERSION_CONFLICT')
    expect(error.status).toBe(409)
  })

  it('Nest 过滤器层错误 {error:{code}} 同样被统一解析', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'ADMIN_FORBIDDEN', message: '无权执行' } }), {
          status: 403,
        }),
      ),
    )
    const client = new AdminClient({ baseUrl: '', getToken: () => 'token' })
    const error = (await client.request('GET', '/x').catch((e: unknown) => e)) as AdminApiError
    expect(error.code).toBe('ADMIN_FORBIDDEN')
  })

  it('请求自动携带内存中的会话令牌', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new AdminClient({ baseUrl: '/api', getToken: () => 'token-1' })
    await client.get('/admin/access/me')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/admin/access/me')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-1')
  })

  it('HTML 401 在解析失败时仍清理会话', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Unauthorized</html>', { status: 401 })),
    )
    const client = new AdminClient({ baseUrl: '', getToken: () => 'expired', onUnauthorized })
    const error = (await client.get('/x').catch((e: unknown) => e)) as AdminApiError
    expect(error).toBeInstanceOf(AdminApiError)
    expect(error.status).toBe(401)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('成功响应非法 JSON 抛出 502，非 JSON 5xx 保留状态码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>ok</html>', { status: 200 })),
    )
    const client = new AdminClient({ baseUrl: '', getToken: () => 'token' })
    const invalid = (await client.get('/x').catch((e: unknown) => e)) as AdminApiError
    expect(invalid.code).toBe('INVALID_JSON')
    expect(invalid.status).toBe(502)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>oops</html>', { status: 503 })),
    )
    const server = (await client.get('/y').catch((e: unknown) => e)) as AdminApiError
    expect(server.status).toBe(503)
  })

  it('401 时调用 onUnauthorized 并抛出错误', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), { status: 401 }),
        ),
    )
    const client = new AdminClient({ baseUrl: '', getToken: () => 'expired', onUnauthorized })
    await expect(client.get('/x')).rejects.toBeInstanceOf(AdminApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('游标查询串省略空值参数并保留 nextCursor', () => {
    expect(toQuery({ limit: 20, cursor: 'next|cursor', status: undefined })).toBe(
      '?limit=20&cursor=next%7Ccursor',
    )
    expect(toQuery({ limit: 20, cursor: null, status: undefined })).toBe('?limit=20')
  })
})

describe('登录参数', () => {
  it('登录请求体使用 account 与 deviceType，不使用 email', () => {
    const body = buildAccountLoginBody({ account: '  admin_01  ', password: 'password1' })
    expect(body).toEqual({ account: 'admin_01', password: 'password1', deviceType: 'desktop' })
    expect(Object.keys(body)).not.toContain('email')
  })

  it('拒绝过短密码与非法账号', () => {
    expect(validateLoginForm({ account: 'a', password: 'short' }).account).toBeTruthy()
    expect(validateLoginForm({ account: 'admin', password: 'short' }).password).toBeTruthy()
    expect(validateLoginForm({ account: 'admin', password: 'password1' })).toEqual({})
  })
})

describe('写命令结果', () => {
  it('409 版本冲突单独分类且不视为失败可重放', async () => {
    const result = await runCommand(() =>
      Promise.reject(new AdminApiError('CAMPAIGN_VERSION_CONFLICT', '版本已变化', 409)),
    )
    expect(result.status).toBe('conflict')
  })

  it('写操作网络失败归为结果未知，不建议立即重试发放', async () => {
    const result = await runCommand(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(result.status).toBe('unknown')
  })

  it('写操作 5xx 归为结果未知', async () => {
    const result = await runCommand(() =>
      Promise.reject(new AdminApiError('INTERNAL_SERVER_ERROR', '服务异常', 500)),
    )
    expect(result.status).toBe('unknown')
  })
})
