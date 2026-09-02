export const routes = {
  today: (): string => '/today',
  desk: (): string => '/desk',
  settings: (): string => '/settings',
  problems: (): string => '/problems',
  inbox: (): string => '/inbox',
  dateRecords: (dateKey: string): string => `/records/${encodeURIComponent(dateKey)}`,
  timeline: (): string => '/timeline',
  boxRecords: (topicId: string): string => `/boxes/${encodeURIComponent(topicId)}`,
  auth: (): string => '/auth',
} as const

export const TOP_LEVEL_PATHS = [
  routes.today(),
  routes.desk(),
  routes.settings(),
  routes.problems(),
  routes.inbox(),
] as const

export type TopLevelPath = (typeof TOP_LEVEL_PATHS)[number]

export function isTopLevelPath(value: unknown): boolean {
  return typeof value === 'string' && TOP_LEVEL_PATHS.includes(value as TopLevelPath)
}
