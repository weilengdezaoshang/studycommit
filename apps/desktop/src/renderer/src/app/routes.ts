export const TOPIC_SECTIONS = ['overview', 'notes', 'map', 'logs'] as const
export type TopicSection = (typeof TOPIC_SECTIONS)[number]

export function isTopicSection(value: unknown): value is TopicSection {
  return typeof value === 'string' && TOPIC_SECTIONS.includes(value as TopicSection)
}

const encodeId = (id: string): string => encodeURIComponent(id)

export const routes = {
  today: (): string => '/today',
  drafts: (): string => '/drafts',
  topics: (): string => '/topics',
  review: (): string => '/review',
  settings: (): string => '/settings',
  topicOverview: (topicId: string): string => `/topics/${encodeId(topicId)}/overview`,
  topicNotes: (topicId: string): string => `/topics/${encodeId(topicId)}/notes`,
  topicMap: (topicId: string): string => `/topics/${encodeId(topicId)}/map`,
  topicLogs: (topicId: string): string => `/topics/${encodeId(topicId)}/logs`,
  note: (topicId: string, noteId: string): string =>
    `/topics/${encodeId(topicId)}/notes/${encodeId(noteId)}`,
} as const

export const TOP_LEVEL_PATHS = [
  routes.today(),
  routes.drafts(),
  routes.topics(),
  routes.review(),
  routes.settings(),
] as const

export type TopLevelPath = (typeof TOP_LEVEL_PATHS)[number]

export function isTopLevelPath(value: unknown): boolean {
  return typeof value === 'string' && TOP_LEVEL_PATHS.includes(value as TopLevelPath)
}

export function isTodayNavActive(pathname: string): boolean {
  return pathname === routes.today() || pathname === '/'
}
