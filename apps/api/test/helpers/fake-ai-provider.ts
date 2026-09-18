import { AiUnavailableError } from '../../src/ai/ai-provider'

export interface FakeCompletion {
  text: string
  model?: string
}

/**
 * 可控 FakeProvider:按脚本逐次响应,绝不触发真实供应商调用。
 * 脚本项可以是返回值、抛出的错误,或省略(沿用最后一项)。
 */
export class FakeAiProvider {
  readonly model = 'fake-model'
  readonly protocol = 'openai'
  readonly calls: Array<Record<string, unknown>> = []
  private script: Array<(() => Promise<FakeCompletion>) | FakeCompletion>

  constructor(script: Array<FakeCompletion | Error | (() => Promise<FakeCompletion>)>) {
    this.script = script.map((item) => {
      if (typeof item === 'function') {
return item as () => Promise<FakeCompletion>
}
      if (item instanceof Error) {
        return () => Promise.reject(item) as () => Promise<FakeCompletion>
      }
      return item
    })
  }

  async complete(request: { system: string; user: string }): Promise<FakeCompletion> {
    this.calls.push(request)
    const index = Math.min(this.calls.length - 1, this.script.length - 1)
    const item = this.script[index]
    if (!item) {
      throw new AiUnavailableError('FakeProvider 脚本为空')
    }
    const value = typeof item === 'function' ? await item() : item
    return { model: this.model, ...value }
  }

  get callCount(): number {
    return this.calls.length
  }

  /** 重置脚本(保留调用计数),用于模拟迟到结果等场景。 */
  setScript(script: Array<FakeCompletion | Error | (() => Promise<FakeCompletion>)>) {
    this.script = script.map((item) => {
      if (typeof item === 'function') {
return item as () => Promise<FakeCompletion>
}
      if (item instanceof Error) {
        return () => Promise.reject(item) as () => Promise<FakeCompletion>
      }
      return item
    })
  }
}

export function validExplainJson(): string {
  return JSON.stringify({
    view: {
      type: 'causal_chain',
      steps: [
        { title: '第一步', detail: '用户发起解释请求' },
        { title: '第二步', detail: '服务端冻结积分并调用模型' },
      ],
    },
    example: '这个流程好比先扣小票再取餐。',
    plainLevel: 1,
  })
}
