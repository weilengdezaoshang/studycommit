import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { loadNavigationPreferences, saveNavigationPreferences } from './navigation-preferences'
import { isTopicSection, isTopLevelPath, type TopLevelPath } from './routes'

export function NavigationPersistence(): null {
  const { pathname } = useLocation()

  useEffect(() => {
    const preferences = loadNavigationPreferences(window.localStorage)
    if (isTopLevelPath(pathname)) {
      preferences.lastTopLevelPath = pathname as TopLevelPath
    } else {
      const match = pathname.match(/^\/topics\/([^/]+)\/(overview|notes|map|logs)(?:\/|$)/)
      if (match && isTopicSection(match[2])) {
        preferences.lastTopLevelPath = '/topics'
        preferences.lastTopicSectionById[decodeURIComponent(match[1])] = match[2]
      }
    }
    saveNavigationPreferences(window.localStorage, preferences)
  }, [pathname])

  return null
}
