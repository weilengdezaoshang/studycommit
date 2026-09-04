import type { RemoveTopicInput, RemoveTopicOutput, UpdateTopicInput } from '../ports'
import { detachTopicPapers, type StorePaper } from './detach-papers'
import { normalizeTopicName, TOPIC_NAME_ERROR_MESSAGE } from './topic-name'

/** 本地 store 中箱子的核心形态:桌面端与移动端至少都携带这些字段。 */
export interface StoreTopic {
  id: string
  name: string
  color: string
  version: number
}

/**
 * 两端纸页 store 共用的箱子变更宿主:桌面端与移动端通过它接入各自的
 * 状态容器与远端通道,公共流程只关心快照、乐观更新与回滚。
 */
export interface TopicStoreHost<TTopic extends StoreTopic, TPaper extends StorePaper> {
  /** 远端通道可用且当前数据源自服务端时才发起同步。 */
  canSync(): boolean
  getTopics(): TTopic[]
  getPapers(): TPaper[]
  setTopics(topics: TTopic[]): void
  setPapers(papers: TPaper[]): void
  /** 把服务端主题映射为本地展示形态(移动端补充模板等字段)。 */
  toLocalTopic(saved: StoreTopic, previous: TTopic): TTopic
  /** 服务端变更失败后强制刷新,消除乐观窗口内的其他变更。 */
  refresh(): void
  updateTopic(input: UpdateTopicInput): Promise<StoreTopic>
  removeTopic(input: RemoveTopicInput): Promise<RemoveTopicOutput>
}

/**
 * 重命名箱子:本地乐观更新,可同步时携带版本调用服务端,失败回滚并刷新。
 */
export async function renameStoreTopic<TTopic extends StoreTopic, TPaper extends StorePaper>(
  host: TopicStoreHost<TTopic, TPaper>,
  topicId: string,
  name: string,
): Promise<TTopic | undefined> {
  const previous = host.getTopics().find((topic) => topic.id === topicId)
  if (!previous) {
    return undefined
  }
  const normalizedName = normalizeTopicName(name)
  if (!normalizedName) {
    throw new Error(TOPIC_NAME_ERROR_MESSAGE)
  }
  if (!host.canSync()) {
    const optimistic = { ...previous, name: normalizedName }
    host.setTopics(host.getTopics().map((topic) => (topic.id === topicId ? optimistic : topic)))
    return optimistic
  }
  const previousTopics = host.getTopics()
  try {
    const saved = await host.updateTopic({
      id: topicId,
      name: normalizedName,
      version: previous.version,
    })
    const localTopic = host.toLocalTopic(saved, previous)
    host.setTopics(host.getTopics().map((topic) => (topic.id === topicId ? localTopic : topic)))
    return localTopic
  } catch (error) {
    host.setTopics(previousTopics)
    host.refresh()
    throw error
  }
}

/**
 * 删除箱子:本地把箱子移除并把箱内纸页移回待整理,可同步时携带版本调用服务端,失败回滚并刷新。
 */
export async function deleteStoreTopic<TTopic extends StoreTopic, TPaper extends StorePaper>(
  host: TopicStoreHost<TTopic, TPaper>,
  topicId: string,
): Promise<void> {
  const previous = host.getTopics().find((topic) => topic.id === topicId)
  if (!previous) {
    return
  }
  const previousTopics = host.getTopics()
  const previousPapers = host.getPapers()
  host.setTopics(previousTopics.filter((topic) => topic.id !== topicId))
  host.setPapers(detachTopicPapers(host.getPapers(), topicId, new Date().toISOString()))
  if (!host.canSync()) {
    return
  }
  try {
    await host.removeTopic({ id: topicId, version: previous.version })
  } catch (error) {
    host.setTopics(previousTopics)
    host.setPapers(previousPapers)
    host.refresh()
    throw error
  }
}
