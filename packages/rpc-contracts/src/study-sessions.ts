import { z } from 'zod'

export const studySessionStatusSchema = z.enum(['running', 'paused', 'completed'])

export const startStudySessionInputSchema = z.object({
  topicId: z.uuid(),
  goal: z.string().trim().max(500).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(200),
})

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
  completionSource: z.enum(['online', 'offline_sync']).nullable(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export type StudySessionStatus = z.infer<typeof studySessionStatusSchema>
export type StartStudySessionInput = z.infer<typeof startStudySessionInputSchema>
export type StudySession = z.infer<typeof studySessionSchema>
