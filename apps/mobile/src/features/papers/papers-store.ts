import { useSyncExternalStore } from 'react'
import * as Crypto from 'expo-crypto'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import type { Topic } from '@studycommit/rpc-contracts/topics'
import type { PaperApi, TopicApi } from '@studycommit/common/ports'
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
  source: 'seed' | 'server'
  syncing: boolean
}

const listeners = new Set<() => void>()

let state: PapersState = {
  papers: buildSeedPapers(),
  topics: buildSeedTopics(),
  extras: buildSeedPaperExtras(),
  source: 'seed',
  syncing: false,
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

let remoteServices: { papers: PaperApi; topics: TopicApi } | null = null

export function configurePapersServices(services: { papers: PaperApi; topics: TopicApi }): void {
  remoteServices = services
}

async function loadRemote(): Promise<void> {
  if (!remoteServices) {
    return
  }
  setState({ syncing: true })
  try {
    const [papers, topics] = await Promise.all([
      remoteServices.papers.list({ limit: 100 }),
      remoteServices.topics.listActive({ limit: 100 }),
    ])
    setState({
      papers: papers.items,
      extras: Object.fromEntries(
        papers.items
          .filter(
            (paper) =>
              paper.hasQuestion || paper.isQuestionResolved || state.extras[paper.id]?.photoPath,
          )
          .map((paper) => [
            paper.id,
            {
              hasQuestion: paper.hasQuestion,
              isQuestionResolved: paper.isQuestionResolved,
              photoPath: state.extras[paper.id]?.photoPath ?? null,
            },
          ]),
      ),
      topics: topics.items.map((topic) => ({
        ...topic,
        templateId: MOCK_TEMPLATES[0].id,
        template: templateSummaryOf(MOCK_TEMPLATES[0].id),
        paperCount: papers.items.filter((paper) => paper.topicId === topic.id).length,
        lastPaperAt: null,
      })),
      source: 'server',
    })
  } catch {
    // 首次加载失败时保留演示数据，后续操作仍可重试
  } finally {
    setState({ syncing: false })
  }
}

export function uuid(): string {
  return Crypto.randomUUID()
}

export const papersActions = {
  async createPaper(input: {
    content: string
    hasQuestion?: boolean
    photoPath?: string
  }): Promise<Paper> {
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
      hasQuestion: Boolean(input.hasQuestion),
      isQuestionResolved: false,
    }
    setState({
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
    if (remoteServices && state.source === 'server') {
      try {
        const saved = await remoteServices.papers.create({
          content: paper.content,
          hasQuestion: Boolean(input.hasQuestion),
        })
        setState({
          papers: state.papers.map((item) => (item.id === paper.id ? saved : item)),
          extras: {
            ...state.extras,
            ...(input.hasQuestion || input.photoPath
              ? {
                  [saved.id]: {
                    hasQuestion: saved.hasQuestion,
                    isQuestionResolved: saved.isQuestionResolved,
                    photoPath: input.photoPath ?? null,
                  },
                }
              : {}),
          },
        })
        return saved
      } catch (error) {
        const remainingExtras = { ...state.extras }
        delete remainingExtras[paper.id]
        setState({
          papers: state.papers.filter((item) => item.id !== paper.id),
          extras: remainingExtras,
        })
        throw error
      }
    }
    return paper
  },

  async organizePaper(id: string, topicId: string): Promise<Paper | undefined> {
    const previous = state.papers.find((paper) => paper.id === id)
    if (!previous) {
      return undefined
    }
    setState({
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
    if (remoteServices && state.source === 'server') {
      try {
        const saved = await remoteServices.papers.organize({
          id,
          version: previous.version,
          topicId,
        })
        setState({ papers: state.papers.map((item) => (item.id === id ? saved : item)) })
        return saved
      } catch (error) {
        setState({ papers: state.papers.map((item) => (item.id === id ? previous : item)) })
        throw error
      }
    }
    return state.papers.find((paper) => paper.id === id)
  },

  resolveQuestion(id: string) {
    const extra = state.extras[id]
    if (!extra) {
      return
    }
    setState({
      extras: { ...state.extras, [id]: { ...extra, isQuestionResolved: true } },
    })
  },

  async createTopic(name: string): Promise<Topic> {
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
    setState({ topics: [...state.topics, topic] })
    if (remoteServices && state.source === 'server') {
      try {
        const saved = await remoteServices.topics.create({ name })
        const mobileTopic: Topic = {
          ...saved,
          templateId: template.id,
          template: templateSummaryOf(template.id),
          paperCount: 0,
          lastPaperAt: null,
        }
        setState({
          topics: state.topics.map((item) => (item.id === topic.id ? mobileTopic : item)),
        })
        return mobileTopic
      } catch (error) {
        setState({ topics: state.topics.filter((item) => item.id !== topic.id) })
        throw error
      }
    }
    return topic
  },
}

export { loadRemote }
