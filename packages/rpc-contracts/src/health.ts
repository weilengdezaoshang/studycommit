import { oc } from '@orpc/contract'
import { z } from 'zod'

export const livenessSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('studycommit-api'),
  timestamp: z.iso.datetime({ offset: true }),
})

export const healthContract = {
  liveness: oc
    .route({ method: 'GET', path: '/health/live', summary: '检查 API 进程是否存活' })
    .output(livenessSchema),
}

export type Liveness = z.infer<typeof livenessSchema>
