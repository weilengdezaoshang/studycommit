import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { loadNavigationPreferences, saveNavigationPreferences } from './navigation-preferences'
import { isTopLevelPath, type TopLevelPath } from './routes'

export function NavigationPersistence(): null {
  const { pathname } = useLocation()

  useEffect(() => {
    const preferences = loadNavigationPreferences(window.localStorage)
    if (isTopLevelPath(pathname)) {
      preferences.lastTopLevelPath = pathname as TopLevelPath
    }
    saveNavigationPreferences(window.localStorage, preferences)
  }, [pathname])

  return null
}
