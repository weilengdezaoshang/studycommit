export const REASON_MIN = 1
export const REASON_MAX = 500

export function validateReason(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length < REASON_MIN) {
return '必须填写操作理由'
}
  if (trimmed.length > REASON_MAX) {
return `理由不能超过 ${REASON_MAX} 字`
}
  return null
}

export function normalizeReason(value: string): string {
  return value.trim()
}
