import { z } from 'zod'

/**
 * AI 基建契约(第一阶段:陪学追问)。
 * 红线:AI 只产生候选内容,是否保存由用户确认;每次输出必须携带模型与 Prompt 版本。
 */

export const followupQuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
})

export const sharedMemoryDraftSchema = z.object({
  /** 用户解释的要点复述 */
  summary: z.string().trim().min(1).max(2000),
  /** 解释中暴露的关键缺口 */
  gap: z.string().trim().min(1).max(2000),
})

export const companionFollowupInputSchema = z.object({
  sessionId: z.uuid().optional(),
  topicId: z.uuid().nullable().optional(),
  /** 用户用自己的话做的讲解(30~90 秒表达) */
  expression: z.string().trim().min(1).max(4000),
})

export const companionFollowupOutputSchema = z.object({
  /** 1~2 个追问,用于暴露解释缺口,不直接给答案 */
  questions: z.array(followupQuestionSchema).min(1).max(2),
  /** 候选共同记忆,用户确认后才保存 */
  memoryDraft: sharedMemoryDraftSchema.nullable(),
  /** 来源信息:模型与 Prompt 版本 */
  model: z.string().min(1).max(120),
  promptVersion: z.string().min(1).max(60),
})

export const agentRunStatusSchema = z.enum(['pending', 'completed', 'failed'])

export type FollowupQuestion = z.infer<typeof followupQuestionSchema>
export type SharedMemoryDraft = z.infer<typeof sharedMemoryDraftSchema>
export type CompanionFollowupInput = z.infer<typeof companionFollowupInputSchema>
export type CompanionFollowupOutput = z.infer<typeof companionFollowupOutputSchema>
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>
