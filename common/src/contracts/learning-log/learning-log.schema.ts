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
