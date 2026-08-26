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

export const learningRecordPageSchema = z.object({
  items: z.array(z.unknown()),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
})

export type LearningRecordInput = z.infer<typeof learningRecordInputSchema>
export type LearningRecord = z.infer<typeof learningRecordSchema>
export type ListLearningRecordsInput = z.infer<typeof listLearningRecordsInputSchema>
export type LearningRecordPage = z.infer<typeof learningRecordPageSchema>
