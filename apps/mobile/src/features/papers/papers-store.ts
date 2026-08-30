import { useSyncExternalStore } from 'react'
import * as Crypto from 'expo-crypto'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import type { Topic } from '@studycommit/rpc-contracts/topics'
import {
  MOCK_TEMPLATES,
  buildSeedPaperExtras,
  buildSeedPapers,
  buildSeedTopics,
  templateSummaryOf,
  type PaperExtra,
} from './mock-data'

export type PapersState = {
  papers: Paper[]
  topics: Topic[]
  extras: Record<string, PaperExtra>
}

const listeners = new Set<() => void>()

let state: PapersState = {
  papers: buildSeedPapers(),
  topics: buildSeedTopics(),
  extras: buildSeedPaperExtras(),
}

function setState(next: PapersState) {
  state = next
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

export function uuid(): string {
  return Crypto.randomUUID()
}

export const papersActions = {
  createPaper(input: { content: string; hasQuestion?: boolean; photoPath?: string }): Paper {
    const now = new Date().toISOString()
    const paper: Paper = {
      id: uuid(),
      content: input.content,
      status: 'inbox',
      topicId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    setState({
      ...state,
      papers: [...state.papers, paper],
      extras:
        input.hasQuestion || input.photoPath
          ? {
              ...state.extras,
              [paper.id]: {
                hasQuestion: Boolean(input.hasQuestion),
                isQuestionResolved: false,
                photoPath: input.photoPath ?? null,
              },
            }
          : state.extras,
    })
    return paper
  },

  organizePaper(id: string, topicId: string) {
    setState({
      ...state,
      papers: state.papers.map((paper) =>
        paper.id === id
          ? {
              ...paper,
              status: 'organized' as const,
              topicId,
              version: paper.version + 1,
              updatedAt: new Date().toISOString(),
            }
          : paper,
      ),
    })
  },

  resolveQuestion(id: string) {
    const extra = state.extras[id]
    if (!extra) {
      return
    }
    setState({
      ...state,
      extras: { ...state.extras, [id]: { ...extra, isQuestionResolved: true } },
    })
  },

  createTopic(name: string): Topic {
    const now = new Date().toISOString()
    const template = MOCK_TEMPLATES[0]
    const topic: Topic = {
      id: uuid(),
      userId: uuid(),
      name,
      description: null,
      color: '#53635A',
      templateId: template.id,
      template: templateSummaryOf(template.id),
      status: 'active',
      totalDurationSeconds: 0,
      paperCount: 0,
      lastPaperAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    setState({ ...state, topics: [...state.topics, topic] })
    return topic
  },
}
