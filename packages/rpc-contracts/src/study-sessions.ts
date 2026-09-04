import { oc } from '@orpc/contract'
import { z } from 'zod'
import { learningRecordSchema } from './learning-records.js'

export const studySessionStatusSchema = z.enum(['running', 'paused', 'completed'])

/** 幂等键通过 idempotency-key 请求头传递,不进入请求体。 */
export const startStudySessionInputSchema = z.object({
  topicId: z.uuid(),
  goal: z.string().trim().max(500).nullable().optional(),
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

const sessionIdInputSchema = z.object({ id: z.uuid() })
const sessionCommandInputSchema = z.object({ id: z.uuid(), version: z.number().int().min(1) })

export const completeSessionInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(1),
  endedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  completionSource: z.enum(['online', 'offline_sync']).optional(),
  gains: z.string().nullable().optional(),
  problems: z.string().nullable().optional(),
  nextStep: z.string().nullable().optional(),
})

export const activeSessionResponseSchema = z.object({
  session: studySessionSchema.nullable(),
  serverNow: z.iso.datetime({ offset: true }),
})

export const completeSessionResultSchema = z.object({
  session: studySessionSchema,
  learningLog: learningRecordSchema,
})

export const studySessionContract = {
  start: oc
    .route({ method: 'POST', path: '/study-sessions', summary: '开始学习会话' })
    .input(startStudySessionInputSchema)
    .output(studySessionSchema),
  active: oc
    .route({ method: 'GET', path: '/study-sessions/active', summary: '查询进行中的学习会话' })
    .output(activeSessionResponseSchema),
  byId: oc
    .route({ method: 'GET', path: '/study-sessions/{id}', summary: '查看学习会话' })
    .input(sessionIdInputSchema)
    .output(studySessionSchema),
  pause: oc
    .route({ method: 'POST', path: '/study-sessions/{id}/pause', summary: '暂停学习会话' })
    .input(sessionCommandInputSchema)
    .output(studySessionSchema),
  resume: oc
    .route({ method: 'POST', path: '/study-sessions/{id}/resume', summary: '恢复学习会话' })
    .input(sessionCommandInputSchema)
    .output(studySessionSchema),
  complete: oc
    .route({ method: 'POST', path: '/study-sessions/{id}/complete', summary: '完成学习会话' })
    .input(completeSessionInputSchema)
    .output(completeSessionResultSchema),
}

export type StudySessionStatus = z.infer<typeof studySessionStatusSchema>
export type StartStudySessionInput = z.input<typeof startStudySessionInputSchema>
export type StudySession = z.infer<typeof studySessionSchema>
export type ActiveSessionResponse = z.infer<typeof activeSessionResponseSchema>
export type CompleteSessionResult = z.infer<typeof completeSessionResultSchema>
