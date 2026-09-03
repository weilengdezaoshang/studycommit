import { ConfigService } from '@nestjs/config'
import type { AppEnv } from '../config/env'

/** 供应商抽象:上层只依赖该端口,协议差异由各适配器消化。 */
export const AI_PROVIDER_TOKEN = 'AI_PROVIDER'

export type AiProtocol = 'openai' | 'anthropic' | 'gemini'

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
  readonly protocol: AiProtocol
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

interface AiProviderOptions {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/** 各协议公共的请求包装:超时中断、错误归类。 */
async function requestJson(
  options: AiProviderOptions,
  build: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await build(controller.signal)
    if (!response.ok) {
      throw new AiUnavailableError(`AI 服务返回 ${response.status}`)
    }
    return (await response.json()) as unknown
  } catch (error) {
    if (error instanceof AiUnavailableError || error instanceof AiOutputInvalidError) {
      throw error
    }
    throw new AiUnavailableError(error instanceof Error ? error.message : 'AI 请求失败')
  } finally {
    clearTimeout(timer)
  }
}

function requireText(text: unknown): string {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new AiOutputInvalidError('AI 响应缺少内容')
  }
  return text
}

/** OpenAI 兼容协议:GLM/Qwen/DeepSeek/OpenAI 均可复用。 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly protocol = 'openai' as const

  constructor(private readonly options: AiProviderOptions) {}

  get model(): string {
    return this.options.model
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const payload = (await requestJson(
      this.options,
      (signal) =>
        (this.options.fetchImpl ?? fetch)(
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
            signal,
          },
        ),
      request.timeoutMs ?? this.options.timeoutMs ?? 15_000,
    )) as { choices?: Array<{ message?: { content?: string } }> }

    const choice = payload.choices?.[0]?.message?.content
    return { text: requireText(choice), model: this.options.model }
  }
}

/** Anthropic Messages 协议:Claude 系列。 */
export class AnthropicProvider implements AiProvider {
  readonly protocol = 'anthropic' as const

  constructor(private readonly options: AiProviderOptions) {}

  get model(): string {
    return this.options.model
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const payload = (await requestJson(
      this.options,
      (signal) =>
        (this.options.fetchImpl ?? fetch)(
          `${this.options.baseUrl.replace(/\/$/, '')}/v1/messages`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': this.options.apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: this.options.model,
              max_tokens: 1024,
              temperature: request.temperature ?? 0.3,
              system: request.system,
              messages: [{ role: 'user', content: request.user }],
            }),
            signal,
          },
        ),
      request.timeoutMs ?? this.options.timeoutMs ?? 15_000,
    )) as { content?: Array<{ type?: string; text?: string }> }

    const text = payload.content
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('')
    return { text: requireText(text), model: this.options.model }
  }
}

/** Google Gemini generateContent 协议。 */
export class GeminiProvider implements AiProvider {
  readonly protocol = 'gemini' as const

  constructor(private readonly options: AiProviderOptions) {}

  get model(): string {
    return this.options.model
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const payload = (await requestJson(
      this.options,
      (signal) =>
        (this.options.fetchImpl ?? fetch)(
          `${this.options.baseUrl.replace(/\/$/, '')}/v1beta/models/${this.options.model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-goog-api-key': this.options.apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: request.system }] },
              contents: [{ role: 'user', parts: [{ text: request.user }] }],
              generationConfig: { temperature: request.temperature ?? 0.3 },
            }),
            signal,
          },
        ),
      request.timeoutMs ?? this.options.timeoutMs ?? 15_000,
    )) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
    return { text: requireText(text), model: this.options.model }
  }
}

/** 各协议默认端点:只配密钥和模型即可用。 */
export const AI_PROTOCOL_DEFAULT_BASE_URL: Record<AiProtocol, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
}

/**
 * 根据环境装配供应商:AI_PROTOCOL 选择协议,未配置密钥时返回 null,
 * 由服务层降级处理(PRD:Agent 不可用时业务流程不受影响)。
 */
export function createAiProviderFromEnv(config: ConfigService<AppEnv>): AiProvider | null {
  const protocol: AiProtocol = (config.get('AI_PROTOCOL') as AiProtocol | undefined) ?? 'openai'
  const apiKey = config.get('AI_API_KEY')
  const model = config.get('AI_MODEL')
  if (!apiKey || !model) {
    return null
  }
  const options: AiProviderOptions = {
    baseUrl: config.get('AI_BASE_URL') ?? AI_PROTOCOL_DEFAULT_BASE_URL[protocol],
    apiKey,
    model,
    timeoutMs: config.get('AI_TIMEOUT_MS') ?? 15_000,
  }
  switch (protocol) {
    case 'anthropic':
      return new AnthropicProvider(options)
    case 'gemini':
      return new GeminiProvider(options)
    case 'openai':
    default:
      return new OpenAiCompatibleProvider(options)
  }
}
