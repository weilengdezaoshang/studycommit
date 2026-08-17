import { z } from 'zod'
import { SESSION_COMPLETION_SOURCE } from './study-session.constants'

export const sessionIdSchema = z.uuid()
export const createStudySessionSchema = z
  .object({
    topicId: z.uuid(),
    goal: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || null)
      .nullable()
      .optional(),
  })
  .strict()

export const sessionCommandSchema = z
  .object({
    version: z.number().int().min(1),
  })
  .strict()

export const completeStudySessionSchema = z
  .object({
    version: z.number().int().min(1),
    endedAt: z.iso.datetime({ offset: true }).optional(),
    completionSource: z
      .enum([SESSION_COMPLETION_SOURCE.online, SESSION_COMPLETION_SOURCE.offlineSync])
      .default(SESSION_COMPLETION_SOURCE.online),
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

export type CreateStudySessionInput = z.infer<typeof createStudySessionSchema>
export type SessionCommandInput = z.infer<typeof sessionCommandSchema>
export type CompleteStudySessionInput = z.infer<typeof completeStudySessionSchema>
