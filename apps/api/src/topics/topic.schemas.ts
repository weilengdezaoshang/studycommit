import { z } from 'zod'
import {
  createTopicInputSchema,
  updateTopicInputObjectSchema,
} from '@studycommit/rpc-contracts/topics'
import { DEFAULT_TOPIC_COLOR } from '../templates/template.constants'
import { TOPIC_STATUS } from './topic.constants'

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toUpperCase())
const description = z
  .string()
  .max(1000)
  .trim()
  .transform((value) => value || null)
  .nullable()
  .optional()

/** 契约 schema 为字段单一来源;这里只补充服务端归一化(去空白、默认色)与严格模式。 */
export const createTopicSchema = createTopicInputSchema
  .extend({ description, color: color.default(DEFAULT_TOPIC_COLOR) })
  .strict()

export const updateTopicSchema = updateTopicInputObjectSchema
  .omit({ id: true })
  .extend({ description })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: '至少需要更新一个字段',
  })

export const listTopicsSchema = z.object({
  status: z.enum([TOPIC_STATUS.active, TOPIC_STATUS.archived]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export const idSchema = z.uuid()
export type CreateTopicInput = z.infer<typeof createTopicSchema>
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>
export type ListTopicsInput = z.infer<typeof listTopicsSchema>
