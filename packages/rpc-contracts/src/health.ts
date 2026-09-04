import { oc } from '@orpc/contract'
import { z } from 'zod'

export const livenessSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('studycommit-api'),
  timestamp: z.iso.datetime({ offset: true }),
})

export const dependencyStatusSchema = z.enum(['up', 'down'])

export const readinessSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  dependencies: z.object({
    postgres: dependencyStatusSchema,
    redis: dependencyStatusSchema,
  }),
})

export const healthContract = {
  liveness: oc
    .route({ method: 'GET', path: '/health/live', summary: '检查 API 进程是否存活' })
    .output(livenessSchema),
  readiness: oc
    .route({ method: 'GET', path: '/health/ready', summary: '检查数据库与缓存依赖' })
    .output(readinessSchema),
}

export type Liveness = z.infer<typeof livenessSchema>
export type Readiness = z.infer<typeof readinessSchema>
