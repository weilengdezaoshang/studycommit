import { z } from 'zod'

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullable(),
  }),
  requestId: z.string(),
  timestamp: z.iso.datetime({ offset: true }),
  path: z.string(),
})

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
