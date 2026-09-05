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
  applyQuestionCommand,
  applyQuestionConfirmed,
  questionFieldsForCreate,
} from '@studycommit/common/paper-runtime'
import type { PaperQuestionStatus } from '@studycommit/rpc-contracts/paper-question'
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
          .filter((paper) => paper.questionStatus !== 'none' || state.extras[paper.id]?.photoPath)
          .map((paper) => [
            paper.id,
            {
              hasQuestion: paper.hasQuestion,
              isQuestionResolved: paper.isQuestionResolved,
              questionStatus: paper.questionStatus,
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

/** 退出登录:丢弃远端同步数据,回到演示种子状态;重新登录后由 loadRemote 覆盖。 */
export function resetPapersStore() {
  setState({
    papers: buildSeedPapers(),
    topics: buildSeedTopics(),
    extras: buildSeedPaperExtras(),
    source: 'seed',
    syncing: false,
  })
}

/** 写回纸页并按状态机派生同步问题侧车字段,保证 extras 与 paper 单一来源一致。 */
function withQuestionExtras(
  extras: Record<string, PaperExtra>,
  paper: Paper,
): Record<string, PaperExtra> {
  const questionExtras: PaperExtra = {
    hasQuestion: paper.hasQuestion,
    isQuestionResolved: paper.isQuestionResolved,
    questionStatus: paper.questionStatus,
    photoPath: extras[paper.id]?.photoPath ?? null,
  }
  if (questionExtras.questionStatus === 'none' && !questionExtras.photoPath) {
    const next = { ...extras }
    delete next[paper.id]
    return next
  }
  return { ...extras, [paper.id]: questionExtras }
}

/** 从 409 错误中取服务端最新实体;不可信时返回 null。 */
function conflictPaperOf(error: unknown): Paper | null {
  const details =
    typeof error === 'object' && error !== null && 'serialized' in error
      ? (error as { serialized?: { details?: { paper?: unknown } } }).serialized?.details
      : null
  const candidate = details?.paper as Paper | undefined
  if (
    candidate &&
    typeof candidate.id === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.questionStatus === 'string'
  ) {
    return candidate
  }
  return null
}

export const papersActions = {
  async createPaper(input: {
    content: string
    hasQuestion?: boolean
    photoPath?: string
    questionText?: string
    /** 草稿锚点(客户端 UUID):重试复用同键,服务端幂等去重防重复纸页 */
    idempotencyKey?: string
    /** 已完成直传的图片上传会话,创建时事务内绑定到纸页 */
    assetUploadIds?: string[]
  }): Promise<Paper> {
    const now = new Date().toISOString()
    const questionFields = questionFieldsForCreate({
      content: input.content,
      hasQuestion: input.hasQuestion,
      questionText: input.questionText,
    })
    const paper: Paper = {
      id: input.idempotencyKey ?? uuid(),
      content: input.content,
      status: 'inbox',
      topicId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      hasQuestion: questionFields.questionStatus !== 'none',
      isQuestionResolved: false,
      questionStatus: questionFields.questionStatus,
      questionText: questionFields.questionText,
      understandingText: null,
      questionResolvedAt: null,
    }
    const withExtras =
      questionFields.questionStatus !== 'none' || input.photoPath
        ? {
            ...state.extras,
            [paper.id]: {
              hasQuestion: paper.hasQuestion,
              isQuestionResolved: false,
              questionStatus: paper.questionStatus,
              photoPath: input.photoPath ?? null,
            },
          }
        : state.extras
    setState({
      papers: [...state.papers, paper],
      extras: withExtras,
    })
    if (remoteServices && state.source === 'server') {
      try {
        const saved = await remoteServices.papers.create(
          {
            content: paper.content,
            hasQuestion: Boolean(input.hasQuestion),
            ...(input.questionText ? { questionText: input.questionText } : {}),
            ...(input.assetUploadIds?.length ? { assetUploadIds: input.assetUploadIds } : {}),
          },
          { idempotencyKey: paper.id },
        )
        setState({
          papers: state.papers.map((item) => (item.id === paper.id ? saved : item)),
          extras: {
            ...state.extras,
            ...(saved.questionStatus !== 'none' || input.photoPath
              ? {
                  [saved.id]: {
                    hasQuestion: saved.hasQuestion,
                    isQuestionResolved: saved.isQuestionResolved,
                    questionStatus: saved.questionStatus,
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

  /**
   * 切换问题状态:乐观更新 + 失败回滚 + 抛错交给页面提示。
   * 与 organizePaper 不同:演示数据(未同步服务端)不发请求,避免对云端不存在的纸页 404。
   */
  async updateQuestionStatus(
    id: string,
    status: PaperQuestionStatus,
  ): Promise<PaperQuestionStatus | null> {
    const previous = state.papers.find((paper) => paper.id === id)
    if (!previous || previous.deletedAt) {
      return null
    }
    const nowIso = new Date().toISOString()
    const optimistic = applyQuestionCommand(previous, { status }, nowIso)
    if (optimistic === previous) {
      return previous.questionStatus
    }
    setState({
      papers: state.papers.map((paper) => (paper.id === id ? optimistic : paper)),
      extras: withQuestionExtras(state.extras, optimistic),
    })
    if (remoteServices && state.source === 'server') {
      try {
        const saved = await remoteServices.papers.updateQuestion({
          id,
          version: previous.version,
          status,
        })
        setState({
          papers: state.papers.map((paper) => (paper.id === id ? saved : paper)),
          extras: withQuestionExtras(state.extras, saved),
        })
        return saved.questionStatus
      } catch (error) {
        // 版本冲突:采纳服务端实体,目标已被另一台设备完成视为成功
        const conflict = conflictPaperOf(error)
        if (conflict) {
          setState({
            papers: state.papers.map((paper) => (paper.id === id ? conflict : paper)),
            extras: withQuestionExtras(state.extras, conflict),
          })
          return conflict.questionStatus
        }
        // 其他失败回滚到操作前状态
        setState({
          papers: state.papers.map((paper) => (paper.id === id ? previous : paper)),
          extras: withQuestionExtras(state.extras, previous),
        })
        throw error
      }
    }
    return optimistic.questionStatus
  },

  async resolveQuestion(id: string): Promise<PaperQuestionStatus | null> {
    return papersActions.updateQuestionStatus(id, 'resolved')
  },

  async reopenQuestion(id: string): Promise<PaperQuestionStatus | null> {
    return papersActions.updateQuestionStatus(id, 'thinking')
  },

  /** AI 解释卡确认成功后本地落定已解决;服务端已在确认事务内写入,不再发起状态请求。 */
  markQuestionConfirmed(id: string) {
    const previous = state.papers.find((paper) => paper.id === id)
    if (!previous) {
      return
    }
    const confirmed = applyQuestionConfirmed(previous, new Date().toISOString())
    setState({
      papers: state.papers.map((paper) => (paper.id === id ? confirmed : paper)),
      extras: withQuestionExtras(state.extras, confirmed),
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
