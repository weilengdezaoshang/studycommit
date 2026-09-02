import { isTopLevelPath, type TopLevelPath } from './routes'

export const NAVIGATION_STORAGE_KEY = 'studycommit:navigation:v1'

export interface NavigationPreferencesV1 {
  version: 1
  lastTopLevelPath: TopLevelPath
}

export const DEFAULT_NAVIGATION_PREFERENCES: NavigationPreferencesV1 = {
  version: 1,
  lastTopLevelPath: '/today',
}

function isNavigationPreferences(value: unknown): value is NavigationPreferencesV1 {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return candidate.version === 1 && isTopLevelPath(candidate.lastTopLevelPath)
}

export function loadNavigationPreferences(storage: Storage): NavigationPreferencesV1 {
  try {
    const raw = storage.getItem(NAVIGATION_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_NAVIGATION_PREFERENCES }
    }
    const parsed: unknown = JSON.parse(raw)
    return isNavigationPreferences(parsed)
      ? { version: 1, lastTopLevelPath: parsed.lastTopLevelPath }
      : { ...DEFAULT_NAVIGATION_PREFERENCES }
  } catch {
    return { ...DEFAULT_NAVIGATION_PREFERENCES }
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
    }),
  )
}
