import { describe, expect, it, vi } from 'vitest'
import {
  AiOutputInvalidError,
  AiUnavailableError,
  AnthropicProvider,
  GeminiProvider,
  OpenAiCompatibleProvider,
} from './ai-provider'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('OpenAiCompatibleProvider', () => {
  it('成功返回模型输出文本', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '{"questions":[{"question":"q"}]}' } }] }),
      )
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
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer key')
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
      fetchImpl: vi
        .fn()
        .mockResolvedValue(jsonResponse({ choices: [] })) as unknown as typeof fetch,
    })

    await expect(provider.complete({ system: 's', user: 'u' })).rejects.toBeInstanceOf(
      AiOutputInvalidError,
    )
  })
})

describe('AnthropicProvider', () => {
  it('按 Messages 协议发送请求并拼接文本段', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [
          { type: 'text', text: '{"questions":' },
          { type: 'text', text: '[{"question":"q"}]}' },
        ],
      }),
    )
    const provider = new AnthropicProvider({
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'key',
      model: 'claude-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const result = await provider.complete({ system: 's', user: 'u' })

    expect(provider.protocol).toBe('anthropic')
    expect(result.text).toBe('{"questions":[{"question":"q"}]}')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers).toMatchObject({
      'x-api-key': 'key',
      'anthropic-version': '2023-06-01',
    })
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('claude-model')
    expect(body.system).toBe('s')
    expect(body.messages).toEqual([{ role: 'user', content: 'u' }])
  })

  it('非 2xx 时抛出不可用错误', async () => {
    const provider = new AnthropicProvider({
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'key',
      model: 'claude-model',
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response('no', { status: 401 })) as unknown as typeof fetch,
    })

    await expect(provider.complete({ system: 's', user: 'u' })).rejects.toBeInstanceOf(
      AiUnavailableError,
    )
  })
})

describe('GeminiProvider', () => {
  it('按 generateContent 协议发送请求并拼接候选文本', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          { content: { parts: [{ text: '{"questions":' }, { text: '[{"question":"q"}]}' }] } },
        ],
      }),
    )
    const provider = new GeminiProvider({
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'key',
      model: 'gemini-model',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const result = await provider.complete({ system: 's', user: 'u' })

    expect(provider.protocol).toBe('gemini')
    expect(result.text).toBe('{"questions":[{"question":"q"}]}')
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-model:generateContent',
    )
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'key' })
    const body = JSON.parse(String(init.body))
    expect(body.systemInstruction.parts[0].text).toBe('s')
    expect(body.contents[0].parts[0].text).toBe('u')
  })

  it('非 2xx 时抛出不可用错误', async () => {
    const provider = new GeminiProvider({
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'key',
      model: 'gemini-model',
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response('no', { status: 400 })) as unknown as typeof fetch,
    })

    await expect(provider.complete({ system: 's', user: 'u' })).rejects.toBeInstanceOf(
      AiUnavailableError,
    )
  })
})

describe('createAiProviderFromEnv', () => {
  const stubConfig = (values: Record<string, string | undefined>) =>
    ({ get: (key: string) => values[key] }) as never

  it('默认使用 OpenAI 兼容协议', async () => {
    const { createAiProviderFromEnv } = await import('./ai-provider.js')
    const provider = createAiProviderFromEnv(stubConfig({ AI_API_KEY: 'key', AI_MODEL: 'glm-5' }))
    expect(provider?.protocol).toBe('openai')
    expect(provider?.model).toBe('glm-5')
  })

  it('按 AI_PROTOCOL 装配 Anthropic 与 Gemini', async () => {
    const { AnthropicProvider, createAiProviderFromEnv, GeminiProvider } =
      await import('./ai-provider.js')
    const anthropic = createAiProviderFromEnv(
      stubConfig({ AI_PROTOCOL: 'anthropic', AI_API_KEY: 'key', AI_MODEL: 'claude-model' }),
    )
    expect(anthropic).toBeInstanceOf(AnthropicProvider)

    const gemini = createAiProviderFromEnv(
      stubConfig({ AI_PROTOCOL: 'gemini', AI_API_KEY: 'key', AI_MODEL: 'gemini-model' }),
    )
    expect(gemini).toBeInstanceOf(GeminiProvider)
  })

  it('缺少密钥或模型时返回 null 降级', async () => {
    const { createAiProviderFromEnv } = await import('./ai-provider.js')
    expect(createAiProviderFromEnv(stubConfig({ AI_MODEL: 'm' }))).toBeNull()
    expect(createAiProviderFromEnv(stubConfig({ AI_API_KEY: 'key' }))).toBeNull()
  })
})
