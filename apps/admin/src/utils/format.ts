import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export const DISPLAY_TIMEZONE = 'Asia/Shanghai'

export function formatDateTime(value: string | null | undefined, pattern = 'YYYY-MM-DD HH:mm:ss') {
  if (!value) {
return '—'
}
  return dayjs(value).tz(DISPLAY_TIMEZONE).format(pattern)
}

export function formatDate(value: string | null | undefined) {
  return formatDateTime(value, 'YYYY-MM-DD')
}

export function formatCredits(value: number | null | undefined) {
  if (value === null || value === undefined) {
return '—'
}
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function formatBudget(value: number | null | undefined) {
  if (value === null || value === undefined) {
return '不限'
}
  return `${formatCredits(value)} 积分`
}

export function formatCost(value: string | number | null | undefined, currency = 'CNY') {
  if (value === null || value === undefined || value === '') {
return '未设'
}
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) {
return String(value)
}
  const formatted = amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
  return currency === 'CNY' ? `¥${formatted}` : `${formatted} ${currency}`
}

export function shortenId(value: string | null | undefined, head = 8) {
  if (!value) {
return '—'
}
  if (value.length <= head + 1) {
return value
}
  return `${value.slice(0, head)}…`
}

export function signedAmount(value: number) {
  const formatted = formatCredits(Math.abs(value))
  if (value > 0) {
return `+${formatted}`
}
  if (value < 0) {
return `-${formatted}`
}
  return formatted
}

export function percent(part: number, total: number) {
  if (!total) {
return 0
}
  return Math.round((part / total) * 100)
}

export function displayName(nickname: string | null | undefined) {
  const text = nickname?.trim()
  return text ? text : '学习者'
}
