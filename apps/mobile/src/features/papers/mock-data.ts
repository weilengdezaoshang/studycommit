import type { Template, TemplateSummary } from '@studycommit/rpc-contracts/templates'
import type { Topic } from '@studycommit/rpc-contracts/topics'
import type { Paper } from '@studycommit/rpc-contracts/papers'

/**
 * 按 rpc-contracts 契约生成的 mock 数据:
 * - Template/Topic/Paper 与后端 zod schema 字段一一对应;
 * - 问题的标记与照片字段后端契约尚未收录,暂以 paperExtras 侧车承载,
 *   后续契约扩展后并入 Paper。
 */

export const MOCK_USER_ID = 'aaaa1111-0000-4000-8000-000000000000'

export const MOCK_TEMPLATES: Template[] = [
  {
    id: 't1e60f00-0000-4000-8000-000000000001',
    name: '素纸',
    icon: 'plain',
    paperBackground: 'plain',
    version: 1,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 't1e60f00-0000-4000-8000-000000000002',
    name: '点阵',
    icon: 'dot',
    paperBackground: 'dot',
    version: 1,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 't1e60f00-0000-4000-8000-000000000003',
    name: '横线',
    icon: 'rule',
    paperBackground: 'rule',
    version: 1,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 't1e60f00-0000-4000-8000-000000000004',
    name: '方格',
    icon: 'grid',
    paperBackground: 'grid',
    version: 1,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    deletedAt: null,
  },
]

const templateById = new Map(MOCK_TEMPLATES.map((template) => [template.id, template]))

export function templateSummaryOf(templateId: string): TemplateSummary {
  const template = templateById.get(templateId)
  if (!template) {
    throw new Error(`未知模板 ${templateId}`)
  }
  return {
    id: template.id,
    name: template.name,
    icon: template.icon,
    paperBackground: template.paperBackground,
  }
}

type TopicSeed = {
  id: string
  name: string
  color: string
  templateId: string
  description: string | null
}

const TOPIC_SEEDS: TopicSeed[] = [
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    name: '系统设计',
    color: '#53635A',
    templateId: 't1e60f00-0000-4000-8000-000000000003',
    description: null,
  },
  {
    id: 'b1000000-0000-4000-8000-000000000002',
    name: '移动端设计',
    color: '#7B867E',
    templateId: 't1e60f00-0000-4000-8000-000000000002',
    description: null,
  },
  {
    id: 'b1000000-0000-4000-8000-000000000003',
    name: '前端基础',
    color: '#A9BCAE',
    templateId: 't1e60f00-0000-4000-8000-000000000004',
    description: null,
  },
  {
    id: 'b1000000-0000-4000-8000-000000000004',
    name: '算法笔记',
    color: '#B9C8BC',
    templateId: 't1e60f00-0000-4000-8000-000000000001',
    description: null,
  },
  {
    id: 'b1000000-0000-4000-8000-000000000005',
    name: '英语学习',
    color: '#CCD6CC',
    templateId: 't1e60f00-0000-4000-8000-000000000001',
    description: null,
  },
  {
    id: 'b1000000-0000-4000-8000-000000000006',
    name: '产品思考',
    color: '#53635A',
    templateId: 't1e60f00-0000-4000-8000-000000000002',
    description: null,
  },
  {
    id: 'b1000000-0000-4000-8000-000000000007',
    name: '读书摘记',
    color: '#7B867E',
    templateId: 't1e60f00-0000-4000-8000-000000000004',
    description: null,
  },
]

function iso(daysAgo: number, hour: number, minute: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

type PaperSeed = {
  id: string
  content: string
  topicId: string | null
  daysAgo: number
  hour: number
  minute: number
  hasQuestion?: boolean
  isQuestionResolved?: boolean
  photoPath?: string
}

const PAPER_SEEDS: PaperSeed[] = [
  {
    id: 'p1000000-0000-4000-8000-000000000001',
    content: '数据库索引不是越多越好，写入成本与查询收益必须结合真实访问模式判断。',
    topicId: 'b1000000-0000-4000-8000-000000000001',
    daysAgo: 2,
    hour: 14,
    minute: 10,
  },
  {
    id: 'p1000000-0000-4000-8000-000000000002',
    content: '为什么 React 的状态更新不是立即生效？批处理和调度分别解决了什么问题？',
    topicId: null,
    daysAgo: 1,
    hour: 9,
    minute: 20,
    hasQuestion: true,
  },
  {
    id: 'p1000000-0000-4000-8000-000000000003',
    content: 'RRWeb 回放的关键是把 DOM 变更序列化成可重放的事件流，增量快照是性能关键。',
    topicId: 'b1000000-0000-4000-8000-000000000003',
    daysAgo: 1,
    hour: 15,
    minute: 5,
    photoPath: 'mock-photo://rrweb',
  },
  {
    id: 'p1000000-0000-4000-8000-000000000004',
    content: 'Expo Router 与 React Navigation 的关系：前者是约定式路由封装,后者是底层导航原语。',
    topicId: 'b1000000-0000-4000-8000-000000000002',
    daysAgo: 0,
    hour: 8,
    minute: 45,
  },
  {
    id: 'p1000000-0000-4000-8000-000000000005',
    content: '动态规划的状态定义比转移方程更重要,定义错了后面全白写。',
    topicId: null,
    daysAgo: 0,
    hour: 11,
    minute: 30,
    hasQuestion: true,
  },
  {
    id: 'p1000000-0000-4000-8000-000000000006',
    content: 'RAG 检索质量的上限在切块策略,不在向量模型本身。',
    topicId: 'b1000000-0000-4000-8000-000000000001',
    daysAgo: 0,
    hour: 16,
    minute: 12,
    hasQuestion: true,
    isQuestionResolved: true,
  },
  {
    id: 'p1000000-0000-4000-8000-000000000007',
    content: '学术词汇要放在语境里背,孤立抄单词表几乎无效。',
    topicId: 'b1000000-0000-4000-8000-000000000005',
    daysAgo: 4,
    hour: 20,
    minute: 40,
  },
  {
    id: 'p1000000-0000-4000-8000-000000000008',
    content: '托底方案要先想清楚失败时的用户体验,再谈技术选型。',
    topicId: 'b1000000-0000-4000-8000-000000000006',
    daysAgo: 5,
    hour: 10,
    minute: 2,
  },
]

export function buildSeedTopics(): Topic[] {
  const now = iso(0, 12, 0)
  return TOPIC_SEEDS.map((seed) => {
    const topicPapers = PAPER_SEEDS.filter((paper) => paper.topicId === seed.id)
    const lastPaperAt = topicPapers.reduce<string | null>((latest, paper) => {
      const createdAt = iso(paper.daysAgo, paper.hour, paper.minute)
      return !latest || createdAt > latest ? createdAt : latest
    }, null)
    return {
      id: seed.id,
      userId: MOCK_USER_ID,
      name: seed.name,
      description: seed.description,
      color: seed.color,
      templateId: seed.templateId,
      template: templateSummaryOf(seed.templateId),
      status: 'active' as const,
      totalDurationSeconds: 0,
      paperCount: topicPapers.length,
      lastPaperAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
  })
}

export function buildSeedPapers(): Paper[] {
  return PAPER_SEEDS.map((seed) => {
    const createdAt = iso(seed.daysAgo, seed.hour, seed.minute)
    return {
      id: seed.id,
      content: seed.content,
      status: seed.topicId ? ('organized' as const) : ('inbox' as const),
      topicId: seed.topicId,
      version: 1,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    }
  })
}

export type PaperExtra = {
  hasQuestion: boolean
  isQuestionResolved: boolean
  photoPath: string | null
}

export function buildSeedPaperExtras(): Record<string, PaperExtra> {
  const extras: Record<string, PaperExtra> = {}
  for (const seed of PAPER_SEEDS) {
    if (seed.hasQuestion || seed.isQuestionResolved || seed.photoPath) {
      extras[seed.id] = {
        hasQuestion: Boolean(seed.hasQuestion),
        isQuestionResolved: Boolean(seed.isQuestionResolved),
        photoPath: seed.photoPath ?? null,
      }
    }
  }
  return extras
}
