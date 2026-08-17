const SENSITIVE_KEYS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-user-id',
  'password',
  'token',
])

const MAX_TEXT_LENGTH = 256

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase())
}

export function redactSensitive(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}…` : value
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  if (seen.has(value)) {
    return '[Circular]'
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, seen))
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? '[redacted]' : redactSensitive(item, seen),
    ]),
  )
}

export function summarizeErrorBody(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.startsWith('<') || compact.toLowerCase().includes('<html')) {
    return '[non-json body omitted]'
  }
  return compact.length > MAX_TEXT_LENGTH ? `${compact.slice(0, MAX_TEXT_LENGTH)}…` : compact
}
