/*
 * 三端共用的日历计算(小程序/桌面/移动)。
 * 本文件是唯一源,位于 @studycommit/common 的 study-session-runtime;
 * 桌面/移动端直接从 '@studycommit/common/study-session-runtime' 引入。
 * 小程序运行时无法解析工作区包,在 apps/miniprogram/utils/calendar.ts
 * 保留内容完全一致的运行时镜像副本,由其 utils/calendar.sync.test.ts
 * 强制同步:修改任一侧后必须同步另一侧。
 */

export type DateParts = { year: number; month: number; day: number }

export const MAX_CELL_LEVEL = 3
export const DAYS_PER_WEEK = 7

export type CalendarCell = {
  dateKey: string
  dayLabel: string
  count: number
  level: number
  isSelected: boolean
  isBlank: boolean
}

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function parseDateKey(value: string): DateParts {
  const [year, month, day] = value.split('-').map(Number)
  return {
    year: Number.isInteger(year) ? year : 2026,
    month: Number.isInteger(month) ? month : 8,
    day: Number.isInteger(day) ? day : 27,
  }
}

export function toDateKey(parts: DateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function toDateKeyFromDate(date: Date): string {
  return toDateKey({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })
}

export function getMonthDayCount(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function formatDateLabel(parts: DateParts): string {
  return `${parts.month}月${parts.day}日`
}

const MONTH_NAMES = [
  '',
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
]

export function formatMonthTitle(month: number): string {
  return MONTH_NAMES[month] ?? `${month}月`
}

/**
 * 月份切换：在 dateKey 基础上偏移 delta 个月，保留日；
 * 目标月没有该日（如 1 月 31 日切到 2 月）时取当月最后一天。
 */
export function shiftDateKey(dateKey: string, delta: number): string {
  const parts = parseDateKey(dateKey)
  const target = new Date(parts.year, parts.month - 1 + delta, 1)
  const next: DateParts = {
    year: target.getFullYear(),
    month: target.getMonth() + 1,
    day: Math.min(parts.day, getMonthDayCount(target.getFullYear(), target.getMonth() + 1)),
  }
  return toDateKey(next)
}

function blankCell(dateKey: string): CalendarCell {
  return { dateKey, dayLabel: '', count: 0, level: 0, isSelected: false, isBlank: true }
}

function toCell(
  dateKey: string,
  selectedDateKey: string,
  countByDate: Record<string, number>,
): CalendarCell {
  const day = Number(dateKey.slice(8, 10))
  const count = countByDate[dateKey] ?? 0
  return {
    dateKey,
    dayLabel: String(day),
    count,
    level: Math.min(count, MAX_CELL_LEVEL),
    isSelected: dateKey === selectedDateKey,
    isBlank: false,
  }
}

/** 周历：以 anchorDateKey 所在周为准，固定返回周一至周日 7 格。 */
export function buildWeekCells(
  anchorDateKey: string,
  selectedDateKey: string,
  countByDate: Record<string, number>,
): CalendarCell[] {
  const anchor = parseDateKey(anchorDateKey)
  const anchorDate = new Date(anchor.year, anchor.month - 1, anchor.day, 12)
  const mondayOffset = (anchorDate.getDay() + 6) % 7
  const monday = new Date(anchorDate)
  monday.setDate(anchorDate.getDate() - mondayOffset)
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return toCell(toDateKeyFromDate(date), selectedDateKey, countByDate)
  })
}

/** 月历：返回当月全部格子，月初按周一为第一列补空白。 */
export function buildMonthCells(
  year: number,
  month: number,
  selectedDateKey: string,
  countByDate: Record<string, number>,
): CalendarCell[] {
  const blanks = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const leadingBlanks = Array.from({ length: blanks }, (_, index) => blankCell(`blank-${index}`))
  const dayCount = getMonthDayCount(year, month)
  const days = Array.from({ length: dayCount }, (_, index) =>
    toCell(toDateKey({ year, month, day: index + 1 }), selectedDateKey, countByDate),
  )
  return [...leadingBlanks, ...days]
}

/** 将月历格子按每行 7 格分块，末尾不足一周补空白，保证每行等宽。 */
export function chunkIntoWeeks(cells: CalendarCell[]): CalendarCell[][] {
  const padded = [...cells]
  while (padded.length % DAYS_PER_WEEK !== 0) {
    padded.push(blankCell(`blank-tail-${padded.length}`))
  }
  const weeks: CalendarCell[][] = []
  for (let start = 0; start < padded.length; start += DAYS_PER_WEEK) {
    weeks.push(padded.slice(start, start + DAYS_PER_WEEK))
  }
  return weeks
}
