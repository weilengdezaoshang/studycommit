export const PAPER_BACKGROUND = {
  plain: 'plain',
  dot: 'dot',
  rule: 'rule',
  grid: 'grid',
} as const

export type PaperBackground = (typeof PAPER_BACKGROUND)[keyof typeof PAPER_BACKGROUND]

export const SYSTEM_TEMPLATE = {
  plain: {
    id: 'aa000000-0000-4000-8000-000000000001',
    name: '空白',
    icon: 'box',
    paperBackground: PAPER_BACKGROUND.plain,
  },
  dot: {
    id: 'aa000000-0000-4000-8000-000000000002',
    name: '点阵',
    icon: 'dot',
    paperBackground: PAPER_BACKGROUND.dot,
  },
  rule: {
    id: 'aa000000-0000-4000-8000-000000000003',
    name: '横线',
    icon: 'rule',
    paperBackground: PAPER_BACKGROUND.rule,
  },
  grid: {
    id: 'aa000000-0000-4000-8000-000000000004',
    name: '方格',
    icon: 'grid',
    paperBackground: PAPER_BACKGROUND.grid,
  },
} as const

export const DEFAULT_TEMPLATE_ID = SYSTEM_TEMPLATE.plain.id
export const DEFAULT_TOPIC_COLOR = '#DCE9D8'

export const TEMPLATE_ERROR = {
  notFound: { code: 'TEMPLATE_NOT_FOUND', message: '模板不存在' },
} as const
