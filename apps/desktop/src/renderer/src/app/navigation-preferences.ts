import { isTopicSection, isTopLevelPath, type TopicSection, type TopLevelPath } from './routes'

export const NAVIGATION_STORAGE_KEY = 'studycommit:navigation:v1'

export interface NavigationPreferencesV1 {
  version: 1
  lastTopLevelPath: TopLevelPath
  lastTopicSectionById: Record<string, TopicSection>
}

export const DEFAULT_NAVIGATION_PREFERENCES: NavigationPreferencesV1 = {
  version: 1,
  lastTopLevelPath: '/today',
  lastTopicSectionById: {},
}

function isNavigationPreferences(value: unknown): value is NavigationPreferencesV1 {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  if (candidate.version !== 1 || !isTopLevelPath(candidate.lastTopLevelPath)) {
    return false
  }
  if (!candidate.lastTopicSectionById || typeof candidate.lastTopicSectionById !== 'object') {
    return false
  }

  return Object.entries(candidate.lastTopicSectionById).every(
    ([topicId, section]) => topicId.length > 0 && isTopicSection(section),
  )
}

export function loadNavigationPreferences(storage: Storage): NavigationPreferencesV1 {
  try {
    const raw = storage.getItem(NAVIGATION_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_NAVIGATION_PREFERENCES, lastTopicSectionById: {} }
    }
    const parsed: unknown = JSON.parse(raw)
    return isNavigationPreferences(parsed)
      ? parsed
      : { ...DEFAULT_NAVIGATION_PREFERENCES, lastTopicSectionById: {} }
  } catch {
    return { ...DEFAULT_NAVIGATION_PREFERENCES, lastTopicSectionById: {} }
  }
}

export function saveNavigationPreferences(
  storage: Storage,
  preferences: NavigationPreferencesV1,
): void {
  storage.setItem(
    NAVIGATION_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      lastTopLevelPath: preferences.lastTopLevelPath,
      lastTopicSectionById: preferences.lastTopicSectionById,
    }),
  )
}
