import { ConfigService } from '@nestjs/config'
import type { AppEnv } from '../config/env'

/** 供应商抽象:上层只依赖该端口,便于替换供应商与注入测试替身。 */
/** DI 令牌:测试或特殊部署可显式提供供应商实例。 */
export const AI_PROVIDER_TOKEN = 'AI_PROVIDER'

export interface AiCompletionRequest {
  system: string
  user: string
  temperature?: number
  timeoutMs?: number
}

export interface AiCompletionResult {
  text: string
  model: string
}

export interface AiProvider {
  readonly model: string
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>
}

export class AiUnavailableError extends Error {
  constructor(message = 'AI 服务未配置或不可用') {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

export class AiOutputInvalidError extends Error {
  constructor(message = 'AI 输出不符合约定格式') {
    super(message)
    this.name = 'AiOutputInvalidError'
  }
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

/** OpenAI 兼容协议实现:GLM/Qwen/DeepSeek/OpenAI 均可复用。 */
export class OpenAiCompatibleProvider implements AiProvider {
  constructor(
    private readonly options: {
      baseUrl: string
      apiKey: string
      model: string
      fetchImpl?: typeof fetch
    },
  ) {}

  get model(): string {
    return this.options.model
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 15_000)
    try {
      const response = await (this.options.fetchImpl ?? fetch)(
        `${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify({
            model: this.options.model,
            temperature: request.temperature ?? 0.3,
            messages: [
              { role: 'system', content: request.system },
              { role: 'user', content: request.user },
            ],
          }),
          signal: controller.signal,
        },
      )
      if (!response.ok) {
        throw new AiUnavailableError(`AI 服务返回 ${response.status}`)
      }
      const payload = (await response.json()) as ChatCompletionResponse
      const text = payload.choices?.[0]?.message?.content
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new AiOutputInvalidError('AI 响应缺少内容')
      }
      return { text, model: this.options.model }
    } catch (error) {
      if (error instanceof AiUnavailableError || error instanceof AiOutputInvalidError) {
        throw error
      }
      throw new AiUnavailableError(error instanceof Error ? error.message : 'AI 请求失败')
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * 根据环境装配供应商;未配置密钥时返回 null,由服务层降级处理
 * (PRD:Agent 不可用时业务流程不受影响)。
 */
export function createAiProviderFromEnv(config: ConfigService<AppEnv>): AiProvider | null {
  const apiKey = config.get('AI_API_KEY')
  const baseUrl = config.get('AI_BASE_URL')
  const model = config.get('AI_MODEL')
  if (!apiKey || !baseUrl || !model) {
    return null
  }
  return new OpenAiCompatibleProvider({ baseUrl, apiKey, model })
}
