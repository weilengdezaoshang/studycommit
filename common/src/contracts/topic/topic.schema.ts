import { z } from 'zod'

export const topicStatusSchema = z.enum(['active', 'archived'])

export const topicSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(1000).nullable(),
  color: z.string().regex(/^#[0-9A-F]{6}$/),
  status: topicStatusSchema,
  totalDurationSeconds: z.number().int().nonnegative(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const topicPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
})

export const topicPageSchema = z.object({
  items: z.array(topicSchema),
  pageInfo: topicPageInfoSchema,
})

export const listActiveTopicsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict()

export type Topic = z.infer<typeof topicSchema>
export type TopicPage = z.infer<typeof topicPageSchema>
export type ListActiveTopicsInput = z.infer<typeof listActiveTopicsInputSchema>
