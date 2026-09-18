import { describe, expect, it, vi } from 'vitest'
import { AiService } from './ai.service'

const output = {
  view: { type: 'definition_counterexample', definition: '概念解释', counterexample: '一个反例' },
  example: '例子',
  plainLevel: 1,
}

describe('服务商配置解析', () => {
  it('每次执行都重新读取当前配置,进行中请求保持快照', async () => {
    let model = 'first'
    const providerConfig = {
      resolveRuntime: vi.fn(async () => ({
        source: 'database',
        protocol: 'openai',
        version: 1,
        options: { baseUrl: 'https://example.com', apiKey: 'sk-a', model, timeoutMs: 1000 },
      })),
      createProvider: vi.fn((snapshot: { options: { model: string } }) => ({
        complete: async () => {
          const frozen = snapshot.options.model
          await new Promise((resolve) => setTimeout(resolve, 20))
          return { text: JSON.stringify(output), model: frozen }
        },
      })),
    }
    const service = new AiService({} as never, providerConfig as never, null)
    const first = service.completeExplain({ content: '测试', directive: 'initial', round: 1 })
    model = 'second'
    const firstResult = await first
    expect(firstResult.model).toBe('first')
    const second = await service.completeExplain({
      content: '测试',
      directive: 'initial',
      round: 1,
    })
    expect(second.model).toBe('second')
    expect(providerConfig.resolveRuntime).toHaveBeenCalledTimes(2)
  })

  it('显式注入的测试供应商优先,不读取数据库配置', async () => {
    const providerConfig = { resolveRuntime: vi.fn() }
    const injected = {
      complete: vi.fn().mockResolvedValue({ text: JSON.stringify(output), model: 'injected' }),
    }
    const service = new AiService({} as never, providerConfig as never, injected as never)
    const result = await service.completeExplain({
      content: '测试',
      directive: 'initial',
      round: 1,
    })
    expect(result.model).toBe('injected')
    expect(providerConfig.resolveRuntime).not.toHaveBeenCalled()
  })
})
