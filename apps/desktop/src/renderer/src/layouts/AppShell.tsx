import { Outlet, useLocation } from 'react-router'
import { AppHeader } from '../components/AppHeader'
import { ErrorBoundary } from '../components/feedback/ErrorBoundary'
import { Sidebar } from '../components/navigation/Sidebar'
import { NavigationPersistence } from '../app/NavigationPersistence'
import { useStudySessionController } from '@studycommit/common/study-session-react'
import { useDesktopServices } from '../features/study-session/api/DesktopServicesProvider'
import { subscribeWindowFocus } from '../features/study-session/subscribe-window-focus'
import { TodayPage } from '../features/study-session/pages/TodayPage'

function PageOutlet(): React.JSX.Element {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname}>
      <Outlet />
    </ErrorBoundary>
  )
}

export function AppShell(): React.JSX.Element {
  const { studySessions, topics } = useDesktopServices()
  const study = useStudySessionController({
    studySessions,
    topics,
    subscribeForeground: subscribeWindowFocus,
    enablePoll: import.meta.env.MODE !== 'test',
  })
  const { pathname } = useLocation()
  const showToday = pathname === '/today'

  return (
    <div className="app-shell">
      <NavigationPersistence />
      <Sidebar />
      <div className="workspace">
        <AppHeader />
        <main className="content" tabIndex={-1}>
          {showToday ? (
            <ErrorBoundary>
              <TodayPage study={study} />
            </ErrorBoundary>
          ) : (
            <PageOutlet />
          )}
        </main>
      </div>
    </div>
  )
}
