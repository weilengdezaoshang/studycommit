import type { Paper } from '@studycommit/rpc-contracts/papers'

/** 桌面端纸页 mock:与后端 Paper 契约字段一致;问题/照片暂以侧车承载。 */
export type PaperExtra = {
  hasQuestion: boolean
  isQuestionResolved: boolean
  photoPath: string | null
}

export const INBOX_TOPIC_ID = '__inbox__'

export type DesktopTopic = {
  id: string
  name: string
  color: string
  version: number
}

export const DESKTOP_TOPICS: DesktopTopic[] = [
  { id: 'topic-mobile', name: '移动端设计', color: '#7B867E', version: 1 },
  { id: 'topic-js', name: 'JavaScript', color: '#53635A', version: 1 },
]

function iso(daysAgo: number, hour: number, minute: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

export function buildSeedPapers(): Paper[] {
  return [
    {
      id: 'p-2',
      content: '为什么 React 的状态更新不是立即生效？批处理和调度分别解决了什么问题？',
      status: 'inbox',
      topicId: null,
      version: 1,
      createdAt: iso(0, 14, 20),
      updatedAt: iso(0, 14, 20),
      deletedAt: null,
      hasQuestion: true,
      isQuestionResolved: false,
    },
    {
      id: 'p-1',
      content: 'Safe Area 不只是顶部留白，它代表系统界面与应用内容之间需要共同遵守的边界。',
      status: 'organized',
      topicId: 'topic-mobile',
      version: 1,
      createdAt: iso(1, 9, 42),
      updatedAt: iso(1, 9, 42),
      deletedAt: null,
      hasQuestion: true,
      isQuestionResolved: false,
    },
    {
      id: 'p-3',
      content: '闭包会保留创建时的词法作用域，因此回调中可能读到当时捕获的旧变量。',
      status: 'organized',
      topicId: 'topic-js',
      version: 1,
      createdAt: iso(3, 16, 8),
      updatedAt: iso(3, 16, 8),
      deletedAt: null,
      hasQuestion: false,
      isQuestionResolved: false,
    },
  ]
}

export function buildSeedExtras(): Record<string, PaperExtra> {
  return {
    'p-2': { hasQuestion: true, isQuestionResolved: false, photoPath: null },
    'p-1': { hasQuestion: true, isQuestionResolved: false, photoPath: null },
  }
}
