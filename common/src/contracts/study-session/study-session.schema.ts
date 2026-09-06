import { z } from 'zod'
import { learningLogSchema } from '../learning-log/learning-log.schema'

export const studySessionStatusSchema = z.enum(['running', 'paused', 'completed'])
export const studySessionCompletionSourceSchema = z.enum(['online', 'offline_sync'])
export const studySessionSourceSchema = z.enum([
  'manual_topic',
  'desktop_capture',
  'desktop_existing_question',
])

/** 截图学习起步:服务端事务内创建草稿纸页(source=desktop_capture)。 */
export const draftPaperInputSchema = z.object({
  paperId: z.uuid(),
  questionText: z.string().trim().min(1).max(2_000),
  screenshotUploadId: z.uuid().optional(),
  ocrText: z.string().max(20_000).optional(),
})

export const studySessionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  topicId: z.uuid().nullable(),
  paperId: z.uuid().nullable(),
  source: studySessionSourceSchema,
  goal: z.string().nullable(),
  status: studySessionStatusSchema,
  startedAt: z.iso.datetime({ offset: true }),
  pausedAt: z.iso.datetime({ offset: true }).nullable(),
  totalPausedSeconds: z.number().int().nonnegative(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  completionSource: studySessionCompletionSourceSchema.nullable(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export const activeSessionPaperSchema = z.object({
  id: z.uuid(),
  questionText: z.string().nullable(),
  understandingText: z.string().nullable(),
  fragmentCount: z.number().int().nonnegative(),
})

export const activeStudySessionResponseSchema = z.object({
  session: studySessionSchema.nullable(),
  serverNow: z.iso.datetime({ offset: true }),
  paper: activeSessionPaperSchema.nullable(),
})

export const createStudySessionInputSchema = z
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
    draftPaper: draftPaperInputSchema.optional(),
    idempotencyKey: z.string().trim().min(1).max(200),
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

export const sessionIdSchema = z.uuid()

export const sessionCommandInputSchema = z
  .object({
    sessionId: sessionIdSchema,
    version: z.number().int().min(1),
    idempotencyKey: z.string().trim().min(1).max(200),
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

export const completeStudySessionInputSchema = sessionCommandInputSchema
  .extend({
    endedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    completionSource: studySessionCompletionSourceSchema.default('online'),
    gains: optionalSummary(10_000),
    problems: optionalSummary(10_000),
    nextStep: optionalSummary(5_000),
  })
  .superRefine((value, context) => {
    if (value.completionSource === 'offline_sync' && !value.endedAt) {
      context.addIssue({
        code: 'custom',
        path: ['endedAt'],
        message: '离线补交必须提供结束时间',
      })
    }
    if (value.completionSource === 'online' && value.endedAt) {
      context.addIssue({
        code: 'custom',
        path: ['endedAt'],
        message: '在线结束不能指定结束时间',
      })
    }
  })

export const completeStudySessionResultSchema = z.object({
  session: studySessionSchema,
  learningLog: learningLogSchema,
})

export type StudySession = z.infer<typeof studySessionSchema>
export type StudySessionSource = z.infer<typeof studySessionSourceSchema>
export type DraftPaperInput = z.infer<typeof draftPaperInputSchema>
export type ActiveSessionPaper = z.infer<typeof activeSessionPaperSchema>
export type ActiveStudySessionResponse = z.infer<typeof activeStudySessionResponseSchema>
export type CreateStudySessionInput = z.infer<typeof createStudySessionInputSchema>
export type SessionCommandInput = z.infer<typeof sessionCommandInputSchema>
export type CompleteStudySessionInput = z.input<typeof completeStudySessionInputSchema>
export type CompleteStudySessionResult = z.infer<typeof completeStudySessionResultSchema>
