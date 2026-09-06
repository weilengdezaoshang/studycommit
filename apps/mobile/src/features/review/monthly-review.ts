import type { MonthlyReview, ReviewDay } from '@studycommit/common/contracts'
import type { PapersState } from '../papers/papers-store'

/** 装订月份游标与本地聚合(BE-311 服务端不可用时的回退数据源)。 */

export type MonthCursor = { year: number; month: number }

export function monthKeyOf(cursor: MonthCursor): string {
  return `${cursor.year}-${String(cursor.month).padStart(2, '0')}`
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + (cursor.month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function monthLabelOf(cursor: MonthCursor): string {
  return `${cursor.year} 年 ${cursor.month} 月`
}

/** 装订册不允许翻到未来:以本地今天为界。 */
export function canShiftTo(cursor: MonthCursor, today: Date): boolean {
  const next = cursor
  return next.year * 12 + next.month <= today.getFullYear() * 12 + (today.getMonth() + 1)
}

function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 本地聚合:与服务端同语义,但按本地时区;服务端失败时的回退数据源。 */
export function buildLocalMonthlyReview(
  state: Pick<PapersState, 'papers' | 'extras'>,
  cursor: MonthCursor,
): MonthlyReview {
  const month = monthKeyOf(cursor)
  const daysMap = new Map<string, number>()
  let paperCount = 0
  const topicIds = new Set<string>()
  let resolvedCount = 0
  for (const paper of state.papers) {
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

export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export type HeatCell = { dateKey: string | null; count: number; level: 0 | 1 | 2 | 3 }

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
