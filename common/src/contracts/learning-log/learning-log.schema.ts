import { z } from 'zod'

const nullableText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null)

export const learningLogSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  sessionId: z.uuid(),
  topicId: z.uuid(),
  gains: nullableText,
  problems: nullableText,
  nextStep: nullableText,
  effectiveDurationSeconds: z.number().int().nonnegative(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})

export type LearningLog = z.infer<typeof learningLogSchema>

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

export const updateLearningLogInputSchema = z
  .object({
    id: learningLogIdSchema,
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

export type UpdateLearningLogInput = z.input<typeof updateLearningLogInputSchema>
export type UpdateLearningLogBody = Omit<z.infer<typeof updateLearningLogInputSchema>, 'id'>
