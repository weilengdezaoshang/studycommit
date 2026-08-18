const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export function formatLocalDateTimeValue(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function parseLocalDateTimeValue(value: string): Date | null {
  const trimmed = value.trim()
  if (!LOCAL_DATE_TIME.test(trimmed)) {
    return null
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function validateLocalDateTimeValue(value: string, min?: string): string | null {
  if (!value.trim()) {
    return '请填写结束时间'
  }
  const parsed = parseLocalDateTimeValue(value)
  if (!parsed) {
    return '结束时间格式无效，请使用 YYYY-MM-DDTHH:mm'
  }
  if (min) {
    const minDate = parseLocalDateTimeValue(min)
    if (minDate && parsed.getTime() < minDate.getTime()) {
      return '结束时间不能早于开始时间'
    }
  }
  return null
}
