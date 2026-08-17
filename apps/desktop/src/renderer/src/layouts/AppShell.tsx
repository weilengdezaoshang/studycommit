import { Outlet, useLocation } from 'react-router'
import { AppHeader } from '../components/AppHeader'
import { ErrorBoundary } from '../components/feedback/ErrorBoundary'
import { Sidebar } from '../components/navigation/Sidebar'
import { NavigationPersistence } from '../app/NavigationPersistence'

function PageOutlet(): React.JSX.Element {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname}>
      <Outlet />
    </ErrorBoundary>
  )
}

export function AppShell(): React.JSX.Element {
  return (
    <div className="app-shell">
      <NavigationPersistence />
      <Sidebar />
      <div className="workspace">
        <AppHeader />
        <main className="content" tabIndex={-1}>
          <PageOutlet />
        </main>
      </div>
    </div>
  )
}
