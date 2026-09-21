import { useMemo, useState } from 'react'
import { paperWithExtra, isOpenQuestion } from './view-model'
import type { PapersState } from './papers-store'
import type { RecordDay } from './RecordsList'

export type RecordsScope =
  { kind: 'all' } | { kind: 'inbox' } | { kind: 'questions' } | { kind: 'topic'; topicId: string }

/** 桌面列表筛选与日期分镜的派生数据，不承担请求与视图渲染。 */
export function useRecordsView(state: PapersState, scope: RecordsScope, dateKey?: string) {
  const [status, setStatus] = useState<'all' | 'open' | 'resolved'>('all')
  const [order, setOrder] = useState<'recent' | 'earliest'>('recent')
  const base = useMemo(
    () =>
      state.papers
        .filter((paper) => !paper.deletedAt)
        .map((paper) => paperWithExtra(state, paper))
        .filter((paper) => {
          if (scope.kind === 'inbox') {
            return paper.status === 'inbox'
          }
          if (scope.kind === 'questions') {
            return paper.questionStatus !== 'none' || paper.extra.hasQuestion
          }
          if (scope.kind === 'topic') {
            return paper.topicId === scope.topicId
          }
          return true
        }),
    [state, scope],
  )
  const groups = useMemo(() => {
    const days = new Map<string, RecordDay>()
    const papers = base
      .filter(
        (paper) =>
          (!dateKey || paper.createdAt.slice(0, 10) === dateKey) &&
          (status === 'all' ||
            (status === 'open' ? isOpenQuestion(paper) : paper.extra.isQuestionResolved)),
      )
      .sort((a, b) => (order === 'recent' ? -1 : 1) * a.createdAt.localeCompare(b.createdAt))
    for (const paper of papers) {
      const key = paper.createdAt.slice(0, 10)
      const day = days.get(key) ?? { dateKey: key, papers: [] }
      day.papers.push(paper)
      days.set(key, day)
    }
    return [...days.values()]
  }, [base, dateKey, status, order])
  return {
    groups,
    status,
    order,
    setStatus,
    setOrder,
    total: base.length,
    shown: groups.reduce((n, day) => n + day.papers.length, 0),
    topicNames: new Map(state.topics.map((topic) => [topic.id, topic.name])),
  }
}
