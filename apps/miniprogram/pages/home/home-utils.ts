export const MAX_VISIBLE_COUNT = 99
export const DEFAULT_DRAWER_TOPIC_LIMIT = 4
export const DEFAULT_TOPIC_NAME = '未命名的知识'

export function formatDisplayCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0'
  }
  return value > MAX_VISIBLE_COUNT ? `${MAX_VISIBLE_COUNT}+` : String(Math.floor(value))
}

export function getHomeLoadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }
  return '暂时取不回你的学习内容，请重试。'
}

export function getDrawerTopicSummary<T>(topics: T[], limit = DEFAULT_DRAWER_TOPIC_LIMIT) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_DRAWER_TOPIC_LIMIT
  const hasMoreTopics = topics.length > safeLimit

  return {
    visibleTopics: topics.slice(0, safeLimit),
    hasMoreTopics,
    topicOverflowLabel: hasMoreTopics ? `查看全部 ${formatDisplayCount(topics.length)} 个箱子` : '',
  }
}

export function getNextDefaultTopicName(
  topicNames: string[],
  baseName = DEFAULT_TOPIC_NAME,
): string {
  const normalizedBaseName = baseName.trim() || DEFAULT_TOPIC_NAME
  const usedNames = new Set(topicNames.map((name) => name.trim()))
  if (!usedNames.has(normalizedBaseName)) {
    return normalizedBaseName
  }

  let suffix = 2
  while (usedNames.has(`${normalizedBaseName} ${suffix}`)) {
    suffix += 1
  }
  return `${normalizedBaseName} ${suffix}`
}
