export const MONITOR_SCHEMA_VERSION = 1 as const

export const REDACTED_VALUE = '[REDACTED]'

export const SENSITIVE_FIELD_PATTERN = /(token|authorization|password|secret|cookie|phone|openid)/i

export const MONITOR_ERROR_NAMES = {
  STANDARD: 'Error',
  UNKNOWN: 'UnknownError',
} as const

export const UNKNOWN_ERROR_MESSAGE = '发生未知异常'
