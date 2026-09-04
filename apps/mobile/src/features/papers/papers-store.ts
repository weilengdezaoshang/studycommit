import { useSyncExternalStore } from 'react'
import * as Crypto from 'expo-crypto'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import type { Topic } from '@studycommit/rpc-contracts/topics'
import type { Topic as CommonTopic } from '@studycommit/common'
import {
  deleteStoreTopic,
  normalizeTopicName,
  renameStoreTopic,
  TOPIC_NAME_ERROR_MESSAGE,
  type TopicStoreHost,
} from '@studycommit/common/topic-store-runtime'
import type { PaperApi, TopicMutationApi } from '@studycommit/common/ports'
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

/** 非 React 场景读取当前状态，供命令式流程与测试使用。 */
export function getPapersState(): PapersState {
  return getState()
}

let remoteServices: { papers: PaperApi; topics: TopicMutationApi } | null = null

export function configurePapersServices(services: {
  papers: PaperApi
  topics: TopicMutationApi
}): void {
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
    // 新建是用户明确产生的云端数据，即使首屏远端列表仍在加载，也要立即同步。
    if (remoteServices) {
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
    const normalizedName = normalizeTopicName(name)
    if (!normalizedName) {
      throw new Error(TOPIC_NAME_ERROR_MESSAGE)
    }
    const now = new Date().toISOString()
    const template = MOCK_TEMPLATES[0]
    const topic: Topic = {
      id: uuid(),
      userId: uuid(),
      name: normalizedName,
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
    // 新建箱子与新建纸页一样,是用户明确产生的云端数据,即使首屏远端列表仍在加载也要立即同步。
    if (remoteServices) {
      try {
        const saved = await remoteServices.topics.create({ name: normalizedName })
        const mobileTopic = toMobileTopic(saved, topic)
        commitCreatedTopic(topic.id, mobileTopic)
        return mobileTopic
      } catch (error) {
        setState({ topics: state.topics.filter((item) => item.id !== topic.id) })
        throw error
      }
    }
    return topic
  },

  async renameTopic(topicId: string, name: string): Promise<Topic | undefined> {
    return renameStoreTopic(mobileTopicStoreHost(), topicId, name)
  },

  async deleteTopic(topicId: string): Promise<void> {
    return deleteStoreTopic(mobileTopicStoreHost(), topicId)
  },
}

/** 两端共用的箱子变更宿主:接入移动端远端通道与本地状态。 */
function mobileTopicStoreHost(): TopicStoreHost<Topic, Paper> {
  return {
    canSync: () => remoteServices !== null && state.source === 'server',
    getTopics: () => state.topics,
    getPapers: () => state.papers,
    setTopics: (topics) => setState({ topics }),
    setPapers: (papers) => setState({ papers }),
    toLocalTopic: (saved, previous) =>
      // 宿主契约只保证核心字段,但移动端远端通道实际返回完整契约主题
      toMobileTopic(saved as CommonTopic, previous),
    refresh: () => {
      void loadRemote()
    },
    updateTopic: (input) => {
      if (!remoteServices) {
        return Promise.reject(new Error('远端服务未就绪'))
      }
      return remoteServices.topics.update(input)
    },
    removeTopic: (input) => {
      if (!remoteServices) {
        return Promise.reject(new Error('远端服务未就绪'))
      }
      return remoteServices.topics.remove(input)
    },
  }
}

/** 用服务端数据替换本地临时箱子;若加载竞态已把它清除,则追加到列表尾部。 */
function commitCreatedTopic(localId: string, serverTopic: Topic) {
  const exists = state.topics.some((topic) => topic.id === localId)
  setState({
    topics: exists
      ? state.topics.map((topic) => (topic.id === localId ? serverTopic : topic))
      : [...state.topics, serverTopic],
  })
}

function toMobileTopic(topic: CommonTopic, previous?: Topic): Topic {
  const templateId = previous?.templateId ?? MOCK_TEMPLATES[0].id
  return {
    ...topic,
    templateId,
    template: previous?.template ?? templateSummaryOf(templateId),
    paperCount: previous?.paperCount ?? 0,
    lastPaperAt: previous?.lastPaperAt ?? null,
  }
}

export { loadRemote }
