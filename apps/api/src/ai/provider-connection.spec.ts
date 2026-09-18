import { describe, expect, it, vi } from 'vitest'
import { probeProviderConnection } from './provider-connection'

describe('provider-connection', () => {
  it('2xx 视为连接成功且不回显响应正文', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response('secret-from-provider', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      )
    const result = await probeProviderConnection({
      protocol: 'openai',
      baseUrl: 'https://example.com/v1',
      model: 'test-model',
      apiKey: 'sk-not-real',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: true, code: 'connected', message: '连接成功' })
    expect(JSON.stringify(result)).not.toContain('sk-not-real')
    expect(JSON.stringify(result)).not.toContain('secret-from-provider')
    expect(fetchImpl.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: 'error' }))
  })

  it('401 归类为鉴权失败', async () => {
    const result = await probeProviderConnection({
      protocol: 'openai',
      baseUrl: 'https://example.com/v1',
      model: 'm',
      apiKey: 'sk-not-real',
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response('nope', { status: 401 })) as unknown as typeof fetch,
    })
    expect(result.code).toBe('auth_failed')
    expect(result.message).not.toContain('nope')
  })

  it('超时归类为 timeout', async () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    const result = await probeProviderConnection({
      protocol: 'openai',
      baseUrl: 'https://example.com/v1',
      model: 'm',
      apiKey: 'sk-not-real',
      timeoutMs: 10,
      fetchImpl: vi.fn().mockRejectedValue(err) as unknown as typeof fetch,
    })
    expect(result).toEqual({ ok: false, code: 'timeout', message: '连接超时' })
  })

  it('429 归类为服务商限流', async () => {
    const result = await probeProviderConnection({
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude',
      apiKey: 'sk-not-real',
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response('rate', { status: 429 })) as unknown as typeof fetch,
    })
    expect(result.code).toBe('rate_limited')
  })
})
