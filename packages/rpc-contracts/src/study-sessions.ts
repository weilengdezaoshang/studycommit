import { oc } from '@orpc/contract'
import { z } from 'zod'
import { learningRecordSchema } from './learning-records.js'
import { paperSchema } from './papers.js'

export const studySessionStatusSchema = z.enum(['running', 'paused', 'completed'])

/** 会话来源:主题手动 / 截图学习新问题 / 既有问题继续。 */
export const sessionSourceSchema = z.enum([
  'manual_topic',
  'desktop_capture',
  'desktop_existing_question',
])

/** 截图学习起步:事务内创建草稿纸页(source=desktop_capture)并绑定会话。 */
export const draftPaperInputSchema = z.object({
  /** 客户端生成的纸页 UUID,兼作幂等锚点 */
  paperId: z.uuid(),
  questionText: z.string().trim().min(1).max(2_000),
  /** 已完成直传的截图上传会话;提供时绑定到纸页并写入 OCR 原文 */
  screenshotUploadId: z.uuid().optional(),
  ocrText: z.string().max(20_000).optional(),
})

/**
 * 幂等键通过 idempotency-key 请求头传递,不进入请求体。
 * 开始方式三选一:主题路径(topicId)、既有问题继续(paperId)、截图学习(draftPaper)。
 */
export const startStudySessionInputSchema = z
  .object({
    topicId: z.uuid().optional(),
    goal: z.string().trim().max(500).nullable().optional(),
    paperId: z.uuid().optional(),
    draftPaper: draftPaperInputSchema.optional(),
  })
  .refine(
    (value) =>
      [
        value.topicId !== undefined,
        value.paperId !== undefined,
        value.draftPaper !== undefined,
      ].filter(Boolean).length === 1,
    { message: '学习会话必须且只能从主题、已有问题或截图草稿之一开始' },
  )

export const studySessionSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  /** 桌面截图链路的会话可以没有主题。 */
  topicId: z.uuid().nullable(),
  paperId: z.uuid().nullable(),
  source: sessionSourceSchema,
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

/** 活动会话恢复携带的纸页摘要:桌面端重启恢复直接渲染。 */
export const activeSessionPaperSchema = z.object({
  id: z.uuid(),
  questionText: z.string().nullable(),
  understandingText: z.string().nullable(),
  fragmentCount: z.number().int().nonnegative(),
})

export const activeSessionResponseSchema = z.object({
  session: studySessionSchema.nullable(),
  serverNow: z.iso.datetime({ offset: true }),
  paper: activeSessionPaperSchema.nullable(),
})

export const completeSessionResultSchema = z.object({
  session: studySessionSchema,
  learningLog: learningRecordSchema,
})

/** 学习片段:客户端生成 fragmentId,重试幂等;按 position 排序展示。 */
export const paperFragmentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  paperId: z.uuid(),
  sessionId: z.uuid(),
  content: z.string().min(1),
  position: z.number().int().nonnegative(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export const createSessionFragmentInputSchema = z.object({
  id: z.uuid(),
  fragmentId: z.uuid(),
  content: z.string().trim().min(1).max(2_000),
  position: z.number().int().min(0).optional(),
})

export const updateSessionFragmentInputSchema = z.object({
  id: z.uuid(),
  fragmentId: z.uuid(),
  version: z.number().int().min(1),
  content: z.string().trim().min(1).max(2_000).optional(),
  position: z.number().int().min(0).optional(),
})

/** 纸页收尾:写回理解文本,可选创建“下一个问题”纸页(需携带客户端 UUID)。 */
export const completePaperInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(1),
  understandingText: z.string().trim().min(1).max(20_000),
  nextQuestionText: z.string().trim().min(1).max(2_000).optional(),
  nextPaperId: z.uuid().optional(),
})

export const completePaperResultSchema = z.object({
  session: studySessionSchema,
  paper: paperSchema,
  nextPaper: paperSchema.nullable(),
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
  createFragment: oc
    .route({
      method: 'POST',
      path: '/study-sessions/{id}/fragments',
      successStatus: 201,
      summary: '记下一条学习片段',
    })
    .input(createSessionFragmentInputSchema)
    .output(paperFragmentSchema),
  updateFragment: oc
    .route({
      method: 'PATCH',
      path: '/study-sessions/{id}/fragments/{fragmentId}',
      summary: '修改学习片段',
    })
    .input(updateSessionFragmentInputSchema)
    .output(paperFragmentSchema),
  completePaper: oc
    .route({
      method: 'POST',
      path: '/study-sessions/{id}/complete-paper',
      summary: '纸页收尾并回写理解',
    })
    .input(completePaperInputSchema)
    .output(completePaperResultSchema),
}

export type StudySessionStatus = z.infer<typeof studySessionStatusSchema>
export type SessionSource = z.infer<typeof sessionSourceSchema>
export type DraftPaperInput = z.infer<typeof draftPaperInputSchema>
export type StartStudySessionInput = z.input<typeof startStudySessionInputSchema>
export type StudySession = z.infer<typeof studySessionSchema>
export type ActiveSessionResponse = z.infer<typeof activeSessionResponseSchema>
export type CompleteSessionResult = z.infer<typeof completeSessionResultSchema>
export type PaperFragment = z.infer<typeof paperFragmentSchema>
export type CompletePaperResult = z.infer<typeof completePaperResultSchema>
