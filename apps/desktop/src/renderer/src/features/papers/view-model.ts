import {
  buildMonthCells,
  buildWeekCells,
  parseDateKey,
  type CalendarCell,
} from '@studycommit/common/study-session-runtime'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import type { PaperQuestionStatus } from '@studycommit/rpc-contracts/paper-question'
import { paperColors } from './paper-visual'
import type { PapersState } from './papers-store'

export type PaperWithExtra = Paper & {
  extra: {
    hasQuestion: boolean
    isQuestionResolved: boolean
    questionStatus: PaperQuestionStatus
    photoPath: string | null
  }
}

export type TimelineEntry = {
  paper: PaperWithExtra
  timeLabel: string
  topicName: string
  topicColor: string
}

export function formatMonthLabel(parts: { month: number }): string {
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
  return names[parts.month] ?? `${parts.month}月`
}

export function buildDateKeyOf(paper: Paper): string {
  return paper.createdAt.slice(0, 10)
}

export function buildHomeViewModel(state: PapersState) {
  const extrasOf = (paperId: string) =>
    state.extras[paperId] ?? {
      hasQuestion: false,
      isQuestionResolved: false,
      questionStatus: 'none' as const,
      photoPath: null,
    }

  const papers: PaperWithExtra[] = state.papers
    .filter((paper) => !paper.deletedAt)
    .map((paper) => ({ ...paper, extra: extrasOf(paper.id) }))

  const countByDate: Record<string, number> = {}
  for (const paper of papers) {
    const dateKey = buildDateKeyOf(paper)
    countByDate[dateKey] = (countByDate[dateKey] ?? 0) + 1
  }

  const selected = parseDateKey(state.selectedDateKey)
  const monthCells: CalendarCell[] = buildMonthCells(
    selected.year,
    selected.month,
    state.selectedDateKey,
    countByDate,
  )
  const weekCells = buildWeekCells(state.selectedDateKey, state.selectedDateKey, countByDate)

  const topicById = new Map(state.topics.map((topic) => [topic.id, topic]))

  const papersOfDate = papers
    .filter((paper) => buildDateKeyOf(paper) === state.selectedDateKey)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((paper) => {
      const topic = paper.topicId ? topicById.get(paper.topicId) : undefined
      return {
        paper,
        timeLabel: `${String(new Date(paper.createdAt).getHours()).padStart(2, '0')}:${String(new Date(paper.createdAt).getMinutes()).padStart(2, '0')}`,
        topicName: topic?.name ?? '待整理',
        topicColor: topic?.color ?? paperColors.muted,
      }
    })

  const topicRows = state.topics.map((topic) => ({
    ...topic,
    count: papers.filter((paper) => paper.topicId === topic.id).length,
  }))

  return {
    selectedDateParts: selected,
    dateLabel: `${selected.month} 月 ${selected.day} 日`,
    monthCells,
    weekCells,
    papersOfDate,
    dayCount: papersOfDate.length,
    topicRows,
    inboxCount: papers.filter((paper) => paper.status === 'inbox').length,
    problemCount: papers.filter(
      (paper) => paper.extra.hasQuestion && !paper.extra.isQuestionResolved,
    ).length,
  }
}

export type HomeViewModel = ReturnType<typeof buildHomeViewModel>
