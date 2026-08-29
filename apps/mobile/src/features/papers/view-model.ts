import {
  buildMonthCells,
  buildWeekCells,
  chunkIntoWeeks,
  formatDateLabel,
  parseDateKey,
  toDateKey,
  toDateKeyFromDate,
  type CalendarCell,
  type DateParts,
} from '@studycommit/common/study-session-runtime'
import type { PaperWithExtra } from '../../navigation/navigation.types'
import type { PapersState } from './papers-store'
import { paperColors } from './paper-visual'

export const INBOX_TOPIC_ID = '__inbox__'

export type WeekDayCell = CalendarCell & {
  isToday: boolean
  stack: number[]
  hasMore: boolean
}

export type TimelineEntry = {
  paper: PaperWithExtra
  timeLabel: string
  topicName: string
  topicColor: string
}

export type TopicRow = {
  id: string
  name: string
  color: string
  background: 'plain' | 'dot' | 'rule' | 'grid'
  count: number
}

export type HomeViewModel = ReturnType<typeof buildHomeViewModel>

function timeLabelOf(paper: PaperWithExtra): string {
  const date = new Date(paper.createdAt)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function buildHomeViewModel(
  state: PapersState,
  selectedDateKey: string,
  cursor: DateParts,
  selectedTopicId: string | null,
) {
  const extrasOf = (paperId: string) =>
    state.extras[paperId] ?? { hasQuestion: false, isQuestionResolved: false, photoPath: null }

  const papers: PaperWithExtra[] = state.papers
    .filter((paper) => !paper.deletedAt)
    .map((paper) => ({ ...paper, extra: extrasOf(paper.id) }))

  const paperById = new Map(papers.map((paper) => [paper.id, paper]))

  const countByDate: Record<string, number> = {}
  for (const paper of papers) {
    const dateKey = toDateKey(parseDateKey(paper.createdAt.slice(0, 10)))
    countByDate[dateKey] = (countByDate[dateKey] ?? 0) + 1
  }

  const todayKey = toDateKeyFromDate(new Date())

  const weekDays = buildWeekCells(selectedDateKey, selectedDateKey, countByDate).map((cell) => ({
    ...cell,
    isToday: cell.dateKey === todayKey,
    stack: Array.from({ length: Math.min(cell.count, 3) }, (_, index) => index),
    hasMore: cell.count > 3,
  }))

  const monthWeeks = chunkIntoWeeks(
    buildMonthCells(cursor.year, cursor.month, selectedDateKey, countByDate),
  )

  const topicById = new Map(state.topics.map((topic) => [topic.id, topic]))

  const papersOfDate = papers
    .filter((paper) => paper.createdAt.slice(0, 10) === selectedDateKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .filter((paper) => {
      if (selectedTopicId === INBOX_TOPIC_ID) {
        return paper.status === 'inbox'
      }
      if (selectedTopicId) {
        return paper.topicId === selectedTopicId
      }
      return true
    })
    .map((paper) => {
      const topic = paper.topicId ? topicById.get(paper.topicId) : undefined
      return {
        paper,
        timeLabel: timeLabelOf(paper),
        topicName: topic?.name ?? '待整理',
        topicColor: topic?.color ?? paperColors.muted,
      }
    })

  const topicRows: TopicRow[] = state.topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    color: topic.color,
    background: topic.template.paperBackground,
    count: papers.filter((paper) => paper.topicId === topic.id).length,
  }))

  return {
    monthTitle: formatMonthTitle(cursor.month),
    monthNavLabel: `${cursor.year} 年 ${cursor.month} 月`,
    weekSummary: `本周 ${weekDays.reduce((sum, day) => sum + day.count, 0)} 张`,
    weekDays,
    monthWeeks,
    papersOfDate,
    paperById,
    dayCount: papersOfDate.length,
    selectedDateParts: parseDateKey(selectedDateKey),
    topicRows,
    inboxCount: papers.filter((paper) => paper.status === 'inbox').length,
    problemCount: papers.filter(
      (paper) => paper.extra.hasQuestion && !paper.extra.isQuestionResolved,
    ).length,
    resolvedCount: papers.filter(
      (paper) => paper.extra.hasQuestion && paper.extra.isQuestionResolved,
    ).length,
  }
}

export function formatDateLabelOf(isoDate: string): string {
  return formatDateLabel(parseDateKey(isoDate.slice(0, 10)))
}

function formatMonthTitle(month: number): string {
  const names = [
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
  return names[month] ?? `${month}月`
}

export { parseDateKey, toDateKeyFromDate }
