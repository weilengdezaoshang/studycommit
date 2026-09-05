import { useSyncExternalStore } from 'react'
import type { Paper, PaperPage } from '@studycommit/rpc-contracts/papers'
import type { PaperQuestionStatus } from '@studycommit/rpc-contracts/paper-question'
import {
  applyQuestionCommand,
  applyQuestionConfirmed,
  questionExtrasOf,
} from '@studycommit/common/paper-runtime'
import type { SerializedHttpError } from '@studycommit/common/http'
import {
  deleteStoreTopic,
  renameStoreTopic,
  type TopicStoreHost,
} from '@studycommit/common/topic-store-runtime'
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
  /** seed = 本地演示数据;server = 已从服务端加载。 */
  source: 'seed' | 'server'
  syncing: boolean
}

const listeners = new Set<() => void>()

let state: PapersState = {
  papers: buildSeedPapers(),
  topics: DESKTOP_TOPICS,
  extras: buildSeedExtras(),
  selectedDateKey: todayKey(),
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

/** 非 React 场景读取当前状态(测试、命令式逻辑)。 */
export function getPapersState(): PapersState {
  return getState()
}

type IpcEnvelope<T> = { ok: true; data: T } | { ok: false; error?: { message?: string } }

type IpcAttempt<T> = { ok: true; data: T } | { ok: false; error: SerializedHttpError | null }

function isSerializedHttpError(value: unknown): value is SerializedHttpError {
  return typeof value === 'object' && value !== null && 'code' in value && 'details' in value
}

/** 保留错误信封(409 时 details.paper 携带服务端实体,供冲突采纳)。 */
async function attempt<T>(promise: Promise<IpcEnvelope<T>>): Promise<IpcAttempt<T>> {
  const result = await promise
  if (result.ok) {
    return { ok: true, data: result.data }
  }
  return { ok: false, error: isSerializedHttpError(result.error) ? result.error : null }
}

function papersApi(): import('../../types/study-commit-api').StudyCommitPapersApi | null {
  return typeof window !== 'undefined' && window.studyCommit?.papers
    ? window.studyCommit.papers
    : null
}

function topicsApi(): import('../../types/study-commit-api').StudyCommitTopicsApi | null {
  return typeof window !== 'undefined' && window.studyCommit?.topics
    ? window.studyCommit.topics
    : null
}

async function unwrap<T>(promise: Promise<IpcEnvelope<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) {
    throw new Error(result.error?.message ?? '请求失败')
  }
  return result.data
}

/** 两端共用的箱子变更宿主:接入 IPC 远端通道与桌面端本地状态。 */
function createTopicStoreHost(
  api: ReturnType<typeof topicsApi>,
): TopicStoreHost<DesktopTopic, Paper> {
  return {
    canSync: () => api !== null && state.source === 'server',
    getTopics: () => state.topics,
    getPapers: () => state.papers,
    setTopics: (topics) => setState({ topics }),
    setPapers: (papers) => setState({ papers }),
    toLocalTopic: (saved) => ({
      id: saved.id,
      name: saved.name,
      color: saved.color,
      version: saved.version,
    }),
    refresh: () => {
      void papersActions.loadRemote()
    },
    updateTopic: (input) => {
      if (!api) {
        return Promise.reject(new Error('远端通道不可用'))
      }
      return unwrap(api.update(input))
    },
    removeTopic: (input) => {
      if (!api) {
        return Promise.reject(new Error('远端通道不可用'))
      }
      return unwrap(api.remove(input))
    },
  }
}

/** 预加载页数上限:100/页 × 3 页,覆盖演示与早期真实使用量。 */
const REMOTE_PAPER_PAGES = 3

const papersActions = {
  /** 登录后拉取云端纸页与箱子;失败时保留当前数据(演示或上一次成功结果)。 */
  async loadRemote(): Promise<void> {
    const api = papersApi()
    const topics = topicsApi()
    if (!api) {
      return
    }
    setState({ syncing: true })
    try {
      const items: Paper[] = []
      let cursor: string | null = null
      for (let page = 0; page < REMOTE_PAPER_PAGES; page += 1) {
        const result: PaperPage = await unwrap(
          api.list(cursor ? { limit: 100, cursor } : { limit: 100 }),
        )
        items.push(...result.items)
        if (!result.pageInfo.hasNextPage || !result.pageInfo.nextCursor) {
          break
        }
        cursor = result.pageInfo.nextCursor
      }
      const remoteTopics = topics ? await unwrap(topics.listActive({ limit: 100 })) : null
      const nextTopics: DesktopTopic[] =
        remoteTopics?.items.map((topic) => ({
          id: topic.id,
          name: topic.name,
          color: topic.color,
          version: topic.version,
        })) ?? []
      setState(mergeServerState(state, items, nextTopics))
    } catch {
      // 保持当前状态:演示数据或上次成功的数据仍可用
    } finally {
      setState({ syncing: false })
    }
  },

  organizePaper(paperId: string, topicId: string) {
    const target = state.topics.find((topic) => topic.id === topicId)
    if (!target) {
      return
    }
    const previous = state.papers.find((paper) => paper.id === paperId)
    if (!previous || previous.deletedAt) {
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
    const api = papersApi()
    if (api && state.source === 'server') {
      unwrap(api.organize({ id: paperId, version: previous.version, topicId }))
        .then((saved) => replacePaper(saved))
        .catch(() => {
          // 服务端失败时回滚到归档前状态
          setState({
            papers: state.papers.map((paper) => (paper.id === paperId ? previous : paper)),
          })
        })
    }
  },
  selectDate(dateKey: string) {
    setState({ selectedDateKey: dateKey })
  },
  /**
   * 切换问题状态:乐观更新 + 失败回滚;409 时采纳服务端实体。
   * 返回最终生效的问题状态,供页面区分"成功/被其他设备更改/失败"。
   */
  async updateQuestionStatus(
    paperId: string,
    status: PaperQuestionStatus,
    questionText?: string,
  ): Promise<PaperQuestionStatus | null> {
    const previous = state.papers.find((paper) => paper.id === paperId)
    if (!previous || previous.deletedAt) {
      return null
    }
    const nowIso = new Date().toISOString()
    const optimistic = applyQuestionCommand(previous, { status, questionText }, nowIso)
    if (optimistic === previous) {
      return previous.questionStatus
    }
    commitPaper(optimistic)

    const api = papersApi()
    if (api && state.source === 'server') {
      const result = await attempt(
        api.question({ id: paperId, version: previous.version, status, questionText }),
      )
      if (result.ok) {
        commitPaper(result.data)
        return result.data.questionStatus
      }
      const serverPaper = conflictPaperOf(result.error)
      if (serverPaper) {
        commitPaper(serverPaper)
        // 目标状态已被另一台设备完成时静默采纳,否则交给页面提示
        return serverPaper.questionStatus
      }
      // 其他失败回滚到操作前状态
      commitPaper(previous)
      return null
    }
    return optimistic.questionStatus
  },
  async resolveQuestion(paperId: string): Promise<PaperQuestionStatus | null> {
    return papersActions.updateQuestionStatus(paperId, 'resolved')
  },
  async reopenQuestion(paperId: string): Promise<PaperQuestionStatus | null> {
    return papersActions.updateQuestionStatus(paperId, 'thinking')
  },
  /** AI 解释卡确认成功后本地落定已解决;服务端已在确认事务内写入,不再发起状态请求。 */
  markQuestionConfirmed(paperId: string) {
    const previous = state.papers.find((paper) => paper.id === paperId)
    if (!previous) {
      return
    }
    commitPaper(applyQuestionConfirmed(previous, new Date().toISOString()))
  },
  async renameTopic(topicId: string, name: string): Promise<DesktopTopic | undefined> {
    return renameStoreTopic(createTopicStoreHost(topicsApi()), topicId, name)
  },
  async deleteTopic(topicId: string): Promise<void> {
    return deleteStoreTopic(createTopicStoreHost(topicsApi()), topicId)
  },
  createTopic(name: string): DesktopTopic {
    const topic: DesktopTopic = { id: `topic-${Date.now()}`, name, color: '#53635A', version: 1 }
    setState({ topics: [...state.topics, topic] })
    const api = topicsApi()
    if (api) {
      unwrap(api.create({ name }))
        .then((saved) => {
          const serverTopic: DesktopTopic = {
            id: saved.id,
            name: saved.name,
            color: saved.color,
            version: saved.version,
          }
          commitCreatedTopic(topic.id, serverTopic)
        })
        .catch(() => {
          // 建箱失败时保留本地箱子,后续整理操作会按本地状态继续
        })
    }
    return topic
  },
}

/** 用服务端数据替换本地临时箱子;若加载竞态已把它清除,则追加到列表尾部。 */
function commitCreatedTopic(localId: string, serverTopic: DesktopTopic) {
  const exists = state.topics.some((topic) => topic.id === localId)
  setState({
    topics: exists
      ? state.topics.map((topic) => (topic.id === localId ? serverTopic : topic))
      : [...state.topics, serverTopic],
    papers: state.papers.map((paper) =>
      paper.topicId === localId ? { ...paper, topicId: serverTopic.id } : paper,
    ),
  })
}

function replacePaper(saved: Paper) {
  setState({
    papers: state.papers.map((paper) => (paper.id === saved.id ? saved : paper)),
  })
}

/** 写回纸页并按状态机派生同步问题侧车字段,保证 extras 与 paper 单一来源一致。 */
function commitPaper(paper: Paper) {
  setState({
    papers: state.papers.map((item) => (item.id === paper.id ? paper : item)),
    extras: withQuestionExtras(state.extras, paper),
  })
}

function withQuestionExtras(
  extras: Record<string, PaperExtra>,
  paper: Paper,
): Record<string, PaperExtra> {
  const questionExtras = questionExtrasOf(paper)
  const photoPath = extras[paper.id]?.photoPath ?? null
  if (questionExtras.questionStatus === 'none' && !photoPath) {
    const next = { ...extras }
    delete next[paper.id]
    return next
  }
  return { ...extras, [paper.id]: { ...questionExtras, photoPath } }
}

/** 从 409 错误信封中取服务端最新实体;不可信时返回 null。 */
function conflictPaperOf(error: SerializedHttpError | null): Paper | null {
  const details = error?.details as { paper?: unknown } | null | undefined
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

/** 用服务端数据替换本地数据;问题侧车由状态机派生,仅保留仍存在的纸页与本地照片。 */
function mergeServerState(
  previous: PapersState,
  items: Paper[],
  topics: DesktopTopic[],
): Partial<PapersState> {
  const extras: Record<string, PaperExtra> = {}
  for (const paper of items) {
    const questionExtras = questionExtrasOf(paper)
    const photoPath = previous.extras[paper.id]?.photoPath ?? null
    if (questionExtras.questionStatus !== 'none' || photoPath) {
      extras[paper.id] = { ...questionExtras, photoPath }
    }
  }
  return { papers: items, topics, extras, source: 'server' }
}

export { papersActions }

export { INBOX_TOPIC_ID }
