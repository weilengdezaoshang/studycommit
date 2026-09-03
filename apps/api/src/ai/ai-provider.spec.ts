import { describe, expect, it, vi } from 'vitest'
import { AiOutputInvalidError, AiUnavailableError, OpenAiCompatibleProvider } from './ai-provider'

describe('OpenAiCompatibleProvider', () => {
  const okResponse = () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: '{"questions":[{"question":"q"}]}' } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )

  it('成功返回模型输出文本', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse())
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://ai.example.com/v1',
      apiKey: 'key',
      model: 'test-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const result = await provider.complete({ system: 's', user: 'u' })

    expect(result.model).toBe('test-model')
    expect(result.text).toContain('questions')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ai.example.com/v1/chat/completions')
    expect(JSON.parse(String(init.body)).messages).toHaveLength(2)
  })

  it('服务返回非 2xx 时抛出不可用错误', async () => {
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://ai.example.com',
      apiKey: 'key',
      model: 'm',
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response('boom', { status: 503 })) as unknown as typeof fetch,
    })

    await expect(provider.complete({ system: 's', user: 'u' })).rejects.toBeInstanceOf(
      AiUnavailableError,
    )
  })

  it('响应缺少内容时抛出输出无效错误', async () => {
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://ai.example.com',
      apiKey: 'key',
      model: 'm',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ) as unknown as typeof fetch,
    })

    await expect(provider.complete({ system: 's', user: 'u' })).rejects.toBeInstanceOf(
      AiOutputInvalidError,
    )
  })
})
