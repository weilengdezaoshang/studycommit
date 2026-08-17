import { BadRequestException } from '@nestjs/common'

export const IDEMPOTENCY_KEY_MAX_LENGTH = 200
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed'
export const POSTGRES_UNIQUE_VIOLATION = '23505'
export const IDEMPOTENCY_RECORDS_PKEY = 'idempotency_records_pkey'

export const IDEMPOTENCY_ERROR = {
  keyReused: { code: 'IDEMPOTENCY_KEY_REUSED', message: '幂等键已用于不同请求' },
  keyRequired: { code: 'VALIDATION_ERROR', message: 'Idempotency-Key 必填且最多 200 字符' },
} as const

export function requireIdempotencyKey(key?: string) {
  if (!key || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new BadRequestException(IDEMPOTENCY_ERROR.keyRequired)
  }
  return key
}

export function isConstraint(error: unknown, constraint: string) {
  for (
    let current: unknown = error;
    current && typeof current === 'object';
    current = 'cause' in current ? current.cause : undefined
  ) {
    const candidate = current as { constraint?: unknown; code?: unknown; message?: unknown }
    if (candidate.constraint === constraint) {
      return true
    }
    if (
      candidate.code === POSTGRES_UNIQUE_VIOLATION &&
      typeof candidate.message === 'string' &&
      candidate.message.includes(constraint)
    ) {
      return true
    }
  }
  return false
}
