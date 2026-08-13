import { z } from 'zod'

const postgresUrl = z.url().refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol), 'must be a PostgreSQL URL')
const redisUrl = z.url().refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol), 'must be a Redis URL')

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl
})
export type AppEnv = z.infer<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Environment validation failed: ${details}`)
  }
  if (result.data.NODE_ENV === 'test' && !new URL(result.data.DATABASE_URL).pathname.includes('_test')) {
    throw new Error('Environment validation failed: DATABASE_URL must reference a _test database when NODE_ENV=test')
  }
  return result.data
}
