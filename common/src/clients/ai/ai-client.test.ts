import { describe, expect, it } from 'vitest'
import { FakeHttpTransport } from '../../http/fake-http-transport'
import { AiClient } from './ai-client'

describe('AiClient', () => {
  it('解释卡发送 POST /ai/papers/explain 并解析输出', async () => {
    const transport = new FakeHttpTransport(() => ({
      runId: '11111111-1111-4111-8111-111111111111',
      view: {
        type: 'causal_chain',
        steps: [
          { title: '连续调用', detail: '多次 setState 进队' },
          { title: '统一处理', detail: '事件结束后一次渲染' },
        ],
      },
      example: '连续点三次按钮只重渲染一次',
      plainLevel: 1,
      model: 'test-model',
      promptVersion: 'paper-explain@1',
    }))
    const client = new AiClient(transport)

    const output = await client.explainPaper({
      content: 'React 批处理会合并多次更新。',
      directive: 'initial',
      round: 1,
    })

    expect(output.view.type).toBe('causal_chain')
    const request = transport.requests[0]
    expect(request.method).toBe('POST')
    expect(request.path).toBe('/ai/papers/explain')
    expect(request.body).toMatchObject({ directive: 'initial' })
  })

  it('确认解释卡发送确认请求并解析确认结果', async () => {
    const transport = new FakeHttpTransport(() => ({ confirmed: true }))
    const client = new AiClient(transport)

    await expect(
      client.confirmPaperExplain({ runId: '11111111-1111-4111-8111-111111111111' }),
    ).resolves.toEqual({
      confirmed: true,
    })
    expect(transport.requests[0]).toMatchObject({
      method: 'POST',
      path: '/ai/runs/11111111-1111-4111-8111-111111111111/confirm',
    })
  })
})
