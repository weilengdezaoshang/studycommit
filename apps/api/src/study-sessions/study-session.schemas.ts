import { z } from 'zod'
import { SESSION_COMPLETION_SOURCE } from './study-session.constants'

export const sessionIdSchema = z.uuid()

/** 截图学习起步:事务内创建草稿纸页(source=desktop_capture)并绑定会话。 */
export const draftPaperSchema = z
  .object({
    paperId: z.uuid(),
    questionText: z.string().trim().min(1).max(2_000),
    screenshotUploadId: z.uuid().optional(),
    ocrText: z.string().max(20_000).optional(),
  })
  .strict()

export const createStudySessionSchema = z
  .object({
    topicId: z.uuid().optional(),
    goal: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || null)
      .nullable()
      .optional(),
    paperId: z.uuid().optional(),
    draftPaper: draftPaperSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      [
        value.topicId !== undefined,
        value.paperId !== undefined,
        value.draftPaper !== undefined,
      ].filter(Boolean).length === 1,
    { message: '学习会话必须且只能从主题、已有问题或截图草稿之一开始' },
  )

export const sessionCommandSchema = z
  .object({
    version: z.number().int().min(1),
  })
  .strict()

function optionalSummary(max: number) {
  return z
    .string()
    .nullable()
    .optional()
    .transform((value) => {
      if (value == null) {
        return null
      }
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    })
    .refine((value) => value === null || value.length <= max, {
      message: `最多 ${max} 字符`,
    })
}

export const completeStudySessionSchema = z
  .object({
    version: z.number().int().min(1),
    endedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    completionSource: z
      .enum([SESSION_COMPLETION_SOURCE.online, SESSION_COMPLETION_SOURCE.offlineSync])
      .default(SESSION_COMPLETION_SOURCE.online),
    gains: optionalSummary(10_000),
    problems: optionalSummary(10_000),
    nextStep: optionalSummary(5_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.completionSource === SESSION_COMPLETION_SOURCE.offlineSync && !value.endedAt) {
      context.addIssue({ code: 'custom', path: ['endedAt'], message: '离线补交必须提供结束时间' })
    }
    if (value.completionSource === SESSION_COMPLETION_SOURCE.online && value.endedAt) {
      context.addIssue({ code: 'custom', path: ['endedAt'], message: '在线结束不能指定结束时间' })
    }
  })

export const createSessionFragmentSchema = z
  .object({
    fragmentId: z.uuid(),
    content: z.string().trim().min(1).max(2_000),
    position: z.number().int().min(0).optional(),
  })
  .strict()

export const updateSessionFragmentSchema = z
  .object({
    version: z.number().int().min(1),
    content: z.string().trim().min(1).max(2_000).optional(),
    position: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((value) => value.content !== undefined || value.position !== undefined, {
    message: '至少提供内容或位置之一',
  })

export const completePaperSchema = z
  .object({
    version: z.number().int().min(1),
    understandingText: z.string().trim().min(1).max(20_000),
    nextQuestionText: z.string().trim().min(1).max(2_000).optional(),
    nextPaperId: z.uuid().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.nextQuestionText && !value.nextPaperId) {
      context.addIssue({
        code: 'custom',
        path: ['nextPaperId'],
        message: '创建下一个问题纸页需要提供客户端生成的纸页 UUID',
      })
    }
  })

export type CreateStudySessionInput = z.infer<typeof createStudySessionSchema>
export type SessionCommandInput = z.infer<typeof sessionCommandSchema>
export type CompleteStudySessionInput = z.infer<typeof completeStudySessionSchema>
export type CreateSessionFragmentInput = z.infer<typeof createSessionFragmentSchema>
export type UpdateSessionFragmentInput = z.infer<typeof updateSessionFragmentSchema>
export type CompletePaperInput = z.infer<typeof completePaperSchema>
