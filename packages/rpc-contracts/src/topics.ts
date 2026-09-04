import { oc } from '@orpc/contract'
import { z } from 'zod'
import { templateSummarySchema } from './templates.js'

export const topicSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string().min(1).max(18),
  description: z.string().max(1000).nullable(),
  color: z.string().regex(/^#[0-9A-F]{6}$/),
  templateId: z.uuid(),
  template: templateSummarySchema,
  status: z.enum(['active', 'archived']),
  totalDurationSeconds: z.number().int().nonnegative(),
  paperCount: z.number().int().nonnegative(),
  lastPaperAt: z.iso.datetime({ offset: true }).nullable(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const createTopicInputSchema = z.object({
  name: z.string().trim().min(1).max(18),
  description: z.string().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  templateId: z.uuid().optional(),
  status: z.enum(['active', 'archived']).default('active'),
})

/** 不含 refine 的基础对象,供服务端派生专用 schema(避免两份字段定义漂移)。 */
export const updateTopicInputObjectSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(18).optional(),
  description: z.string().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  status: z.enum(['active', 'archived']).optional(),
  version: z.number().int().min(1),
})

export const updateTopicInputSchema = updateTopicInputObjectSchema
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'id' && key !== 'version'), {
    message: '至少需要更新一个字段',
  })

export const removeTopicInputSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().min(1),
  })
  .strict()

export const removeTopicOutputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(2),
  deletedAt: z.iso.datetime({ offset: true }),
})

export const listTopicsInputSchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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

const topicIdInputSchema = z.object({ id: z.uuid() })

export const topicContract = {
  list: oc
    .route({ method: 'GET', path: '/topics', summary: '查询箱子' })
    .input(listTopicsInputSchema)
    .output(topicListSchema),
  get: oc
    .route({ method: 'GET', path: '/topics/{id}', summary: '查看箱子详情' })
    .input(topicIdInputSchema)
    .output(topicSchema),
  create: oc
    .route({ method: 'POST', path: '/topics', summary: '创建箱子' })
    .input(createTopicInputSchema)
    .output(topicSchema),
  update: oc
    .route({ method: 'PATCH', path: '/topics/{id}', summary: '更新箱子' })
    .input(updateTopicInputSchema)
    .output(topicSchema),
  remove: oc
    .route({ method: 'DELETE', path: '/topics/{id}', summary: '删除箱子' })
    .input(removeTopicInputSchema)
    .output(removeTopicOutputSchema),
}

export type Topic = z.infer<typeof topicSchema>
export type CreateTopicInput = z.input<typeof createTopicInputSchema>
export type ListTopicsInput = z.infer<typeof listTopicsInputSchema>
export type TopicList = z.infer<typeof topicListSchema>
export type UpdateTopicInput = z.input<typeof updateTopicInputSchema>
export type RemoveTopicInput = z.infer<typeof removeTopicInputSchema>
export type RemoveTopicOutput = z.infer<typeof removeTopicOutputSchema>
