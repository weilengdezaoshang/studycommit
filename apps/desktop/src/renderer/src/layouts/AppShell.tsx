import { Outlet, useLocation } from 'react-router'
import { AppHeader } from '../components/AppHeader'
import { ErrorBoundary } from '../components/feedback/ErrorBoundary'
import { Sidebar } from '../components/navigation/Sidebar'
import { NavigationPersistence } from '../app/NavigationPersistence'
import { useStudySessionController } from '../features/study-session/hooks/useStudySessionController'
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
  const study = useStudySessionController()
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
