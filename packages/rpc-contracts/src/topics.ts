import { z } from 'zod'

export const topicSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(1000).nullable(),
  color: z.string().regex(/^#[0-9A-F]{6}$/),
  status: z.enum(['active', 'archived']),
  totalDurationSeconds: z.number().int().nonnegative(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const createTopicInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(1000).nullable().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/),
  status: z.enum(['active', 'archived']).default('active'),
})

export const listTopicsInputSchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
})

export const topicPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
})

export const topicListSchema = z.object({
  items: z.array(topicSchema),
  pageInfo: topicPageInfoSchema,
})

export type Topic = z.infer<typeof topicSchema>
export type CreateTopicInput = z.infer<typeof createTopicInputSchema>
export type ListTopicsInput = z.infer<typeof listTopicsInputSchema>
export type TopicList = z.infer<typeof topicListSchema>
