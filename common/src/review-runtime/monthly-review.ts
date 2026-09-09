import type { MonthlyReview, ReviewDay } from '../contracts'
import { monthKeyOf, type MonthCursor } from './month-cursor'

/** 本地聚合的纸页输入:与纸页契约字段结构兼容,不绑定具体端 store。 */
export interface MonthlyReviewPaper {
  deletedAt: string | null
  createdAt: string
  topicId: string | null
  questionStatus: string
  questionResolvedAt: string | null
}

export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 本地聚合:与服务端同语义,但按本地时区;服务端失败时的回退数据源。 */
export function buildLocalMonthlyReview(
  source: { papers: ReadonlyArray<MonthlyReviewPaper> },
  cursor: MonthCursor,
): MonthlyReview {
  const month = monthKeyOf(cursor)
  const daysMap = new Map<string, number>()
  let paperCount = 0
  const topicIds = new Set<string>()
  let resolvedCount = 0
  for (const paper of source.papers) {
    if (paper.deletedAt || !paper.createdAt.startsWith(month)) {
      continue
    }
    paperCount += 1
    if (paper.topicId) {
      topicIds.add(paper.topicId)
    }
    const day = dateKeyOf(new Date(paper.createdAt))
    daysMap.set(day, (daysMap.get(day) ?? 0) + 1)
    if (paper.questionStatus === 'resolved' && paper.questionResolvedAt?.startsWith(month)) {
      resolvedCount += 1
    }
  }
  const days: ReviewDay[] = [...daysMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
  return {
    month,
    timezone: localTimezone(),
    paperCount,
    topicCount: topicIds.size,
    resolvedCount,
    days,
  }
}

export interface HeatCell {
  dateKey: string | null
  count: number
  level: 0 | 1 | 2 | 3
}

/** 当月热力格子:周一开头补空位,按 count 分 3 档深度(0=无记录)。 */
export function heatmapCells(days: ReviewDay[], cursor: MonthCursor): HeatCell[] {
  const countByDate = new Map(days.map((day) => [day.date, day.count]))
  const first = new Date(cursor.year, cursor.month - 1, 1)
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate()
  const leadingEmpty = (first.getDay() + 6) % 7
  const cells: HeatCell[] = Array.from({ length: leadingEmpty }, () => ({
    dateKey: null,
    count: 0,
    level: 0 as const,
  }))
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${monthKeyOf(cursor)}-${String(day).padStart(2, '0')}`
    const count = countByDate.get(dateKey) ?? 0
    const level = count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3
    cells.push({ dateKey, count, level })
  }
  return cells
}
