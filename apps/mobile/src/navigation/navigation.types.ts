import type { Paper } from '@studycommit/rpc-contracts/papers'

/**
 * 移动端 PRD:应用不使用底部 Tab,首页是唯一一级页面;
 * 抽屉、搜索、箱子、装订、问题、详情与 Agent 都从首页进入。
 */
export type RootStackParamList = {
  /** selectedTopicId:从其他页面回到首页时带上箱子筛选;'__inbox__' 表示待整理 */
  Home: { selectedTopicId?: string | null } | undefined
  NoteEditor: undefined
  PaperDetail: { paperId: string }
  Agent: { paperId: string }
  Review: undefined
  Problems: undefined
  Search: undefined
  Topics: undefined
  Collection: { mode: 'box' | 'inbox'; topicId?: string }
}

export type PaperExtra = {
  hasQuestion: boolean
  isQuestionResolved: boolean
  photoPath: string | null
}

export type PaperWithExtra = Paper & { extra: PaperExtra }

declare global {
  // React Navigation 官方类型合并写法。
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
