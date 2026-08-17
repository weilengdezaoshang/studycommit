import { z } from 'zod'
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

export const createTopicSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description,
    color,
    status: z.enum([TOPIC_STATUS.active, TOPIC_STATUS.archived]).default(TOPIC_STATUS.active),
  })
  .strict()

export const updateTopicSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description,
    color: color.optional(),
    status: z.enum([TOPIC_STATUS.active, TOPIC_STATUS.archived]).optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'version'),
    'at least one field must be updated',
  )

export const listTopicsSchema = z.object({
  status: z.enum([TOPIC_STATUS.active, TOPIC_STATUS.archived]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export const idSchema = z.uuid()
export type CreateTopicInput = z.infer<typeof createTopicSchema>
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>
export type ListTopicsInput = z.infer<typeof listTopicsSchema>
