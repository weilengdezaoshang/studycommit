import {
  BadGatewayException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  companionFollowupOutputSchema,
  type CompanionFollowupInput,
  type CompanionFollowupOutput,
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

const SYSTEM_PROMPT = [
  '你是 StudyCommit 的陪学伙伴。用户刚结束一次学习,会用他自己的话把刚学的内容讲给你听。',
  '你的任务:1) 提出 1~2 个追问,用于暴露他解释里的缺口;追问不要直接给出完整答案,也不要扩展成闲聊。',
  '2) 生成一条候选"共同记忆":summary 复述用户解释的要点,gap 指出关键缺口。',
  '只输出 JSON,格式:{"questions":[{"question":"..."}],"memoryDraft":{"summary":"...","gap":"..."}}。',
].join('\n')

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

  async generateCompanionFollowup(
    userId: string,
    input: CompanionFollowupInput,
  ): Promise<CompanionFollowupOutput> {
    if (!this.provider) {
      throw new ServiceUnavailableException(AI_ERROR.unavailable)
    }
    const run = await this.repository.createFollowupRun(userId, input, AI_PROMPT_VERSION)
    try {
      const completion = await this.provider.complete({
        system: SYSTEM_PROMPT,
        user: input.expression,
        temperature: 0.3,
      })
      const output = companionFollowupOutputSchema.parse({
        ...(extractJson(completion.text) as Record<string, unknown>),
        model: completion.model,
        promptVersion: AI_PROMPT_VERSION,
      })
      await this.repository.completeFollowupRun(run.id, output)
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
}
