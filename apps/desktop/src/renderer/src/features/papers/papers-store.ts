import { useSyncExternalStore } from 'react'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import {
  INBOX_TOPIC_ID,
  DESKTOP_TOPICS,
  buildSeedExtras,
  buildSeedPapers,
  type DesktopTopic,
  type PaperExtra,
} from './mock-data'

export type { DesktopTopic }

export function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export type PapersState = {
  papers: Paper[]
  topics: DesktopTopic[]
  extras: Record<string, PaperExtra>
  selectedDateKey: string
}

const listeners = new Set<() => void>()

let state: PapersState = {
  papers: buildSeedPapers(),
  topics: DESKTOP_TOPICS,
  extras: buildSeedExtras(),
  selectedDateKey: todayKey(),
}

function setState(next: Partial<PapersState>) {
  state = { ...state, ...next }
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getState(): PapersState {
  return state
}

export function usePapersState(): PapersState {
  return useSyncExternalStore(subscribe, getState, getState)
}

export const papersActions = {
  organizePaper(paperId: string, topicId: string) {
    if (!state.topics.some((topic) => topic.id === topicId)) {
return
}
    setState({
      papers: state.papers.map((paper) =>
        paper.id === paperId && !paper.deletedAt
          ? {
              ...paper,
              topicId,
              status: 'organized' as const,
              version: paper.version + 1,
              updatedAt: new Date().toISOString(),
            }
          : paper,
      ),
    })
  },
  selectDate(dateKey: string) {
    setState({ selectedDateKey: dateKey })
  },
  resolveQuestion(paperId: string) {
    const extra = state.extras[paperId]
    if (!extra) {
      return
    }
    setState({ extras: { ...state.extras, [paperId]: { ...extra, isQuestionResolved: true } } })
  },
  reopenQuestion(paperId: string) {
    const extra = state.extras[paperId]
    if (!extra) {
      return
    }
    setState({ extras: { ...state.extras, [paperId]: { ...extra, isQuestionResolved: false } } })
  },
  renameTopic(topicId: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) {
      return
    }
    setState({
      topics: state.topics.map((topic) =>
        topic.id === topicId ? { ...topic, name: trimmed } : topic,
      ),
    })
  },
  deleteTopic(topicId: string) {
    if (!state.topics.some((topic) => topic.id === topicId)) {
      return
    }
    setState({
      topics: state.topics.filter((topic) => topic.id !== topicId),
      papers: state.papers.map((paper) =>
        paper.topicId === topicId && !paper.deletedAt
          ? {
              ...paper,
              topicId: null,
              status: 'inbox' as const,
              version: paper.version + 1,
              updatedAt: new Date().toISOString(),
            }
          : paper,
      ),
    })
  },
  createTopic(name: string): DesktopTopic {
    const topic: DesktopTopic = { id: `topic-${Date.now()}`, name, color: '#53635A' }
    setState({ topics: [...state.topics, topic] })
    return topic
  },
}

export { INBOX_TOPIC_ID }
