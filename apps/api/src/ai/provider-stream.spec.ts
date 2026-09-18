import { describe, expect, it, vi } from 'vitest'
import { streamProvider } from './provider-stream'

describe('streamProvider', () => {
  it('模型尚未完成时转发正文增量并正确拼接拆分的中文编码', async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        source = c
      },
    })
    const fetchImpl = vi.fn().mockResolvedValue(new Response(body))
    const iterator = streamProvider(
      'openai',
      { baseUrl: 'https://example.com', apiKey: 'test', model: 'test', fetchImpl },
      { system: '规则', user: '问题' },
    )
    const next = iterator.next()
    const bytes = new TextEncoder().encode(
      'data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\n',
    )
    for (const byte of bytes) {
source.enqueue(new Uint8Array([byte]))
}
    await expect(next).resolves.toEqual({ value: '你好', done: false })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).stream).toBe(true)
    source.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
    source.close()
    await expect(iterator.next()).resolves.toMatchObject({ done: true })
  })
  it('连接提前结束时不把半截正文视作完成', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"半截"}}]}\n\n'))
    const iterator = streamProvider(
      'openai',
      { baseUrl: 'https://example.com', apiKey: 'test', model: 'test', fetchImpl },
      { system: '', user: '' },
    )
    await expect(iterator.next()).resolves.toMatchObject({ value: '半截' })
    await expect(iterator.next()).rejects.toThrow('连接中断')
  })
  it('鉴权失败时返回明确提示且不暴露供应商响应体', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('secret', { status: 401 }))
    const iterator = streamProvider(
      'openai',
      { baseUrl: 'https://example.com', apiKey: 'test', model: 'test', fetchImpl },
      { system: '', user: '' },
    )
    await expect(iterator.next()).rejects.toThrow('API 密钥无效')
  })
})
