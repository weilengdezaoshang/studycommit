import { z } from 'zod'

function patchSummary(max: number) {
  return z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value == null) {
        return null
      }
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    })
    .refine((value) => value === null || value.length <= max, {
      message: `最多 ${max} 字符`,
    })
    .optional()
}

export const learningLogIdSchema = z.uuid()
export const sessionIdSchema = z.uuid()

export const listLearningLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    topicId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: '开始时间不能晚于结束时间',
    path: ['from'],
  })

export type ListLearningLogsQuery = z.infer<typeof listLearningLogsQuerySchema>

export const updateLearningLogSchema = z
  .object({
    version: z.number().int().min(1),
    gains: patchSummary(10_000),
    problems: patchSummary(10_000),
    nextStep: patchSummary(5_000),
  })
  .strict()
  .refine(
    (value) =>
      value.gains !== undefined || value.problems !== undefined || value.nextStep !== undefined,
    '至少提供一个总结字段',
  )

export type UpdateLearningLogInput = z.infer<typeof updateLearningLogSchema>
