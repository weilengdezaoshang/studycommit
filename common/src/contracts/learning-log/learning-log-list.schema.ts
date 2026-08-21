import { z } from 'zod'
import { studySessionSchema } from '../study-session/study-session.schema'
import { topicSchema } from '../topic/topic.schema'
import { learningLogSchema } from './learning-log.schema'

export const listLearningLogsInputSchema = z.object({
  page: z.number().int().min(1).max(10_000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  topicId: z.uuid().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
})

export const learningLogListItemSchema = z.object({
  learningLog: learningLogSchema,
  session: studySessionSchema,
  topic: topicSchema,
})

export const learningLogPageSchema = z.object({
  items: z.array(learningLogListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
})

export type ListLearningLogsInput = z.infer<typeof listLearningLogsInputSchema>
export type LearningLogPage = z.infer<typeof learningLogPageSchema>
