import { z } from 'zod'
import { learningLogSchema } from '../learning-log/learning-log.schema'

export const studySessionStatusSchema = z.enum(['running', 'paused', 'completed'])
export const studySessionCompletionSourceSchema = z.enum(['online', 'offline_sync'])

export const studySessionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  topicId: z.uuid(),
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

export const activeStudySessionResponseSchema = z.object({
  session: studySessionSchema.nullable(),
  serverNow: z.iso.datetime({ offset: true }),
})

export const createStudySessionInputSchema = z
  .object({
    topicId: z.uuid(),
    goal: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || null)
      .nullable()
      .optional(),
    idempotencyKey: z.string().trim().min(1).max(200),
  })
  .strict()

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
export type ActiveStudySessionResponse = z.infer<typeof activeStudySessionResponseSchema>
export type CreateStudySessionInput = z.infer<typeof createStudySessionInputSchema>
export type SessionCommandInput = z.infer<typeof sessionCommandInputSchema>
export type CompleteStudySessionInput = z.input<typeof completeStudySessionInputSchema>
export type CompleteStudySessionResult = z.infer<typeof completeStudySessionResultSchema>
