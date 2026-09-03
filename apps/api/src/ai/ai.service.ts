import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  paperExplainInputSchema,
  paperExplainOutputSchema,
  type PaperExplainInput,
  type PaperExplainOutput,
} from '@studycommit/rpc-contracts/ai'
import type { AppEnv } from '../config/env'
import { AI_ERROR, AI_PROMPT_VERSION } from './ai.constants'
import {
  AI_PROVIDER_TOKEN,
  AiOutputInvalidError,
  AiUnavailableError,
  createAiProviderFromEnv,
  type AiProvider,
} from './ai-provider'
import { AiRepository } from './ai.repository'

const PROMPT_RULES = [
  '你是 StudyCommit 的学习伙伴。基于用户保存的一张"纸页"(学习记录),生成一张解释卡,帮助用户判断自己是否真的理解了它。',
  '先判断内容类型并选择表达结构:机制类用因果链(causal_chain),对比类用对照(contrast),实践经验类用检查步骤(checklist),定义类用一句话定义与反例(definition_counterexample)。',
  '因果链 2~5 步;对照 2~5 组;检查步骤 2~6 步;定义必须附一个反例。另给一个具体例子(example)。',
  '语言必须浅白直说,不堆术语;plainLevel 1~3 表示浅白程度。',
  '只输出 JSON:{"view":{"type":"...","steps|items|definition...":...},"example":"...","plainLevel":1}。',
].join('\n')

function buildUserPrompt(input: PaperExplainInput): string {
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

@Injectable()
export class AiService {
  private provider: AiProvider | null

  constructor(
    @Inject(AiRepository) private readonly repository: AiRepository,
    @Inject(ConfigService) config: ConfigService<AppEnv>,
    @Optional() @Inject(AI_PROVIDER_TOKEN) provider?: AiProvider | null,
  ) {
    // 显式传入供应商用于测试或特殊部署;否则按环境装配,未配置时保持 null 降级
    this.provider = provider === undefined ? createAiProviderFromEnv(config) : provider
  }

  async generatePaperExplain(
    userId: string,
    rawInput: PaperExplainInput,
  ): Promise<PaperExplainOutput> {
    const input = paperExplainInputSchema.parse(rawInput)
    if (!this.provider) {
      throw new ServiceUnavailableException(AI_ERROR.unavailable)
    }
    const run = await this.repository.createExplainRun(userId, input, AI_PROMPT_VERSION)
    try {
      const completion = await this.provider.complete({
        system: PROMPT_RULES,
        user: buildUserPrompt(input),
        temperature: 0.3,
      })
      const output = paperExplainOutputSchema.parse({
        ...(extractJson(completion.text) as Record<string, unknown>),
        runId: run.id,
        model: completion.model,
        promptVersion: AI_PROMPT_VERSION,
      })
      await this.repository.completeExplainRun(run.id, output)
      return output
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.repository.failRun(run.id, message, AI_PROMPT_VERSION)
      if (error instanceof AiUnavailableError) {
        throw new ServiceUnavailableException(AI_ERROR.unavailable)
      }
      if (error instanceof AiOutputInvalidError) {
        throw new BadGatewayException(AI_ERROR.outputInvalid)
      }
      throw error
    }
  }

  async confirmPaperExplain(userId: string, runId: string) {
    const confirmed = await this.repository.confirmRun(runId, userId)
    if (!confirmed) {
      throw new NotFoundException({ code: 'AI_RUN_NOT_FOUND', message: '解释卡记录不存在' })
    }
    return { confirmed: true as const }
  }
}
