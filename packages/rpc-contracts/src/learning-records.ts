import { oc } from '@orpc/contract'
import { z } from 'zod'

export const learningRecordInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(1),
  gains: z.string().max(10000).nullable().optional(),
  problems: z.string().max(10000).nullable().optional(),
  nextStep: z.string().max(5000).nullable().optional(),
})

export const learningRecordSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  sessionId: z.uuid(),
  topicId: z.uuid(),
  gains: z.string().nullable(),
  problems: z.string().nullable(),
  nextStep: z.string().nullable(),
  effectiveDurationSeconds: z.number().int().nonnegative(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export const listLearningRecordsInputSchema = z.object({
  page: z.number().int().min(1).max(10000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  topicId: z.uuid().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
})

/** 列表条目内嵌的主题行:来自 study_sessions -> topics 关联查询,不含模板汇总字段。 */
export const learningRecordTopicRowSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  templateId: z.uuid(),
  status: z.enum(['active', 'archived']),
  totalDurationSeconds: z.number().int().nonnegative(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const learningRecordListItemSchema = z.object({
  learningLog: learningRecordSchema,
  session: z.object({
    id: z.uuid(),
    userId: z.uuid(),
    /** 桌面截图链路的学习会话可以没有主题;有学习记录的旧路径必有主题。 */
    topicId: z.uuid().nullable(),
    paperId: z.uuid().nullable(),
    source: z.enum(['manual_topic', 'desktop_capture', 'desktop_existing_question']),
    goal: z.string().nullable(),
    status: z.enum(['running', 'paused', 'completed']),
    startedAt: z.iso.datetime({ offset: true }),
    pausedAt: z.iso.datetime({ offset: true }).nullable(),
    totalPausedSeconds: z.number().int().nonnegative(),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    durationSeconds: z.number().int().nonnegative().nullable(),
    completionSource: z.enum(['online', 'offline_sync']).nullable(),
    version: z.number().int().min(1),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  }),
  topic: learningRecordTopicRowSchema,
})

export const learningRecordPageSchema = z.object({
  items: z.array(learningRecordListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
})

const learningRecordBySessionInputSchema = z.object({ sessionId: z.uuid() })

export const learningRecordContract = {
  list: oc
    .route({ method: 'GET', path: '/learning-logs', summary: '分页查询学习记录' })
    .input(listLearningRecordsInputSchema)
    .output(learningRecordPageSchema),
  bySession: oc
    .route({
      method: 'GET',
      path: '/study-sessions/{sessionId}/learning-log',
      summary: '查看会话学习记录',
    })
    .input(learningRecordBySessionInputSchema)
    .output(learningRecordSchema),
  update: oc
    .route({ method: 'PATCH', path: '/learning-logs/{id}', summary: '更新学习记录总结' })
    .input(learningRecordInputSchema)
    .output(learningRecordSchema),
}

export type LearningRecordInput = z.infer<typeof learningRecordInputSchema>
export type LearningRecord = z.infer<typeof learningRecordSchema>
export type ListLearningRecordsInput = z.input<typeof listLearningRecordsInputSchema>
export type LearningRecordPage = z.infer<typeof learningRecordPageSchema>
export type LearningRecordListItem = z.infer<typeof learningRecordListItemSchema>
