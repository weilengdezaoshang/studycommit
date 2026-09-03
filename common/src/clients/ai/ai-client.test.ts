import { describe, expect, it } from 'vitest'
import { FakeHttpTransport } from '../../http/fake-http-transport'
import { AiClient } from './ai-client'

describe('AiClient', () => {
  it('陪学追问发送 POST /ai/companion/followup 并解析输出', async () => {
    const transport = new FakeHttpTransport(() => ({
      questions: [{ question: '为什么需要批处理？' }],
      memoryDraft: { summary: '合并更新', gap: '没讲调度时机' },
      model: 'test-model',
      promptVersion: 'companion-followup@1',
    }))
    const client = new AiClient(transport)

    const output = await client.companionFollowup({
      sessionId: '11111111-1111-4111-8111-111111111111',
      topicId: null,
      expression: 'React 批处理会合并多次更新。',
    })

    expect(output.questions).toHaveLength(1)
    const request = transport.requests[0]
    expect(request.method).toBe('POST')
    expect(request.path).toBe('/ai/companion/followup')
    expect(request.body).toMatchObject({ expression: 'React 批处理会合并多次更新。' })
  })
})
