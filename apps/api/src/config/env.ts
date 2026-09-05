import { z } from 'zod'

const postgresUrl = z
  .url()
  .refine(
    (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'must be a PostgreSQL URL',
  )
const redisUrl = z
  .url()
  .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol), 'must be a Redis URL')

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: postgresUrl,
  REDIS_URL: redisUrl,
  AUTH_OTP_STUB: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  AUTH_WECHAT_STUB: z.string().min(1).optional(),
  WECHAT_MINI_APP_ID: z.string().min(1).optional(),
  WECHAT_MINI_APP_SECRET: z.string().min(1).optional(),
  AUTH_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  AUTH_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).default(2_592_000),
  /** AI 基建:AI_PROTOCOL 选择供应商协议(openai 兼容 / anthropic / gemini),未配置密钥时 AI 功能降级 */
  AI_PROTOCOL: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
  AI_API_KEY: z.string().min(1).optional(),
  AI_BASE_URL: z.url().optional(),
  AI_MODEL: z.string().min(1).max(120).optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(15_000),
  /**
   * 图片资产存储(BE-308):S3 兼容对象存储,开发环境用 MinIO 容器。
   * driver=memory 仅供测试;S3 凭据未配置时上传功能整体降级为 503。
   */
  S3_DRIVER: z.enum(['s3', 'memory']).default('s3'),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('studycommit-assets'),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
})
export type AppEnv = z.infer<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Environment validation failed: ${details}`)
  }
  if (
    result.data.NODE_ENV === 'test' &&
    !new URL(result.data.DATABASE_URL).pathname.includes('_test')
  ) {
    throw new Error(
      'Environment validation failed: DATABASE_URL must reference a _test database when NODE_ENV=test',
    )
  }
  if (result.data.NODE_ENV === 'production' && result.data.AUTH_OTP_STUB) {
    throw new Error('Environment validation failed: AUTH_OTP_STUB cannot be set in production')
  }
  if (result.data.NODE_ENV === 'production' && result.data.AUTH_WECHAT_STUB) {
    throw new Error('Environment validation failed: AUTH_WECHAT_STUB cannot be set in production')
  }
  if (result.data.NODE_ENV === 'production' && result.data.S3_DRIVER === 'memory') {
    throw new Error('Environment validation failed: S3_DRIVER=memory cannot be set in production')
  }
  return result.data
}
