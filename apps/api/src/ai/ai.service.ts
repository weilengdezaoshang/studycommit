import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import {
  paperExplainInputSchema,
  paperExplainOutputSchema,
  type PaperExplainInput,
  type PaperExplainOutput,
} from '@studycommit/rpc-contracts/ai'
import { AI_ERROR, AI_PROMPT_VERSION } from './ai.constants'
import { AiProviderConfigService } from './ai-provider-config.service'
import { AI_PROVIDER_TOKEN, AiOutputInvalidError, type AiProvider } from './ai-provider'
import { AiRepository } from './ai.repository'

export const PROMPT_RULES = [
  '你是 StudyCommit 的学习伙伴。基于用户保存的一张"纸页"(学习记录),生成一张解释卡,帮助用户判断自己是否真的理解了它。',
  '先判断内容类型并选择表达结构:机制类用因果链(causal_chain),对比类用对照(contrast),实践经验类用检查步骤(checklist),定义类用一句话定义与反例(definition_counterexample)。',
  '因果链 2~5 步;对照 2~5 组;检查步骤 2~6 步;定义必须附一个反例。另给一个具体例子(example)。',
  '语言必须浅白直说,不堆术语;plainLevel 1~3 表示浅白程度。',
  '只输出 JSON:{"view":{"type":"...","steps|items|definition...":...},"example":"...","plainLevel":1}。',
].join('\n')

export function buildUserPrompt(input: PaperExplainInput): string {
  const lines = [
    `纸页正文:\n${input.content}`,
    input.questionText ? `用户确认的问题:${input.questionText}` : null,
  ]
  if (input.directive === 'plainer') {
    lines.push(
      `用户表示还没明白。用更浅白的说法重写解释卡,plainLevel 提升到 ${Math.min(3, input.round + 1)},并换更生活化的例子。`,
    )
  } else if (input.directive === 'alternative') {
    const target = input.previousViewType ? `不要使用 ${input.previousViewType} 结构` : '换一种结构'
    lines.push(`用户想换一种方式看。${target},选择适合该内容的另一种表达结构。`)
  }
  if (input.round >= 3) {
    lines.push('这是本轮最后一张解释卡,请尽量收敛到最直白的表达。')
  }
  return lines.filter(Boolean).join('\n\n')
}

/** 从模型输出中提取 JSON(容忍 ```json 围栏)。 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new AiOutputInvalidError('AI 输出中没有 JSON')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    throw new AiOutputInvalidError('AI 输出不是合法 JSON')
  }
}

/** AI 执行服务:供应商调用与输出解析;计费受理由 ai-billing 负责。 */
@Injectable()
export class AiService {
  private readonly injectedProvider: AiProvider | null

  constructor(
    @Inject(AiRepository) private readonly repository: AiRepository,
    @Inject(AiProviderConfigService) private readonly providerConfig: AiProviderConfigService,
    @Optional() @Inject(AI_PROVIDER_TOKEN) provider?: AiProvider | null,
  ) {
    // 显式注入用于测试;生产按数据库配置(无配置时回退环境变量)每次请求解析。
    this.injectedProvider = provider ?? null
  }

  /** 受理前检查:缺失或停用时必须在预扣积分前失败。 */
  async isRuntimeAvailable(): Promise<boolean> {
    if (this.injectedProvider) {
return true
}
    try {
      return (await this.providerConfig.resolveRuntime()) !== null
    } catch {
      return false
    }
  }

  /** 供计费 Worker 在事务外调用:返回模型原始输出文本。 */
  async completeExplain(
    input: PaperExplainInput,
    signal?: AbortSignal,
    options?: { modelOverride?: string },
  ): Promise<{ text: string; model: string }> {
    paperExplainInputSchema.parse(input)
    const provider = await this.resolveProvider(options?.modelOverride)
    const completion = await provider.complete({
      system: PROMPT_RULES,
      user: buildUserPrompt(input),
      temperature: 0.3,
      signal,
    })
    return { text: completion.text, model: completion.model }
  }

  /** 解析输出为解释卡契约(携带 runId/model/promptVersion)。 */
  parseExplainOutput(text: string, runId: string, model: string): Omit<PaperExplainOutput, never> {
    return paperExplainOutputSchema.parse({
      ...(extractJson(text) as Record<string, unknown>),
      runId,
      model,
      promptVersion: AI_PROMPT_VERSION,
    })
  }

  mapProviderError(error: unknown): never {
    if (error instanceof AiOutputInvalidError) {
      throw new BadGatewayException(AI_ERROR.outputInvalid)
    }
    throw error
  }

  private async resolveProvider(modelOverride?: string): Promise<AiProvider> {
    if (this.injectedProvider) {
      return this.injectedProvider
    }
    const snapshot = await this.providerConfig.resolveRuntime()
    if (!snapshot) {
      throw new ServiceUnavailableException(AI_ERROR.unavailable)
    }
    return this.providerConfig.createProvider(snapshot, modelOverride)
  }

  async confirmPaperExplain(userId: string, runId: string) {
    const confirmed = await this.repository.confirmRun(runId, userId)
    if (!confirmed) {
      throw new NotFoundException({ code: 'AI_RUN_NOT_FOUND', message: '解释卡记录不存在' })
    }
    return { confirmed: true as const }
  }
}
