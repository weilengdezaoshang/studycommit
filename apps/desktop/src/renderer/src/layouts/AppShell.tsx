import { Outlet, useLocation } from 'react-router'
import { useCallback, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { ErrorBoundary } from '../components/feedback/ErrorBoundary'
import { Sidebar } from '../components/navigation/Sidebar'
import { NavigationPersistence } from '../app/NavigationPersistence'
import { useStudySessionController } from '@studycommit/common/study-session-react'
import { useDesktopServices } from '../features/study-session/api/DesktopServicesProvider'
import { subscribeWindowFocus } from '../features/study-session/subscribe-window-focus'
import { TodayPage } from '../features/study-session/pages/TodayPage'
import { MockTodayPage } from '../features/mock/MockWorkspacePages'

function PageOutlet(): React.JSX.Element {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname}>
      <Outlet />
    </ErrorBoundary>
  )
}

export function AppShell({
  workspaceMode = 'mock',
}: {
  workspaceMode?: 'mock' | 'study-session'
}): React.JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(process.env.NODE_ENV === 'test')
  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const { studySessions, topics, learningLogs } = useDesktopServices()
  const study = useStudySessionController({
    studySessions,
    topics,
    learningLogs,
    subscribeForeground: subscribeWindowFocus,
    enablePoll: process.env.NODE_ENV !== 'test',
  })
  const { pathname } = useLocation()
  const showToday = pathname === '/today'

  return (
    <div className="app-shell">
      <NavigationPersistence />
      <Sidebar open={drawerOpen} onClose={closeDrawer} />
      <div className="workspace">
        <AppHeader drawerOpen={drawerOpen} onMenu={openDrawer} />
        <main className="content" tabIndex={-1}>
          {showToday ? (
            <ErrorBoundary>
              {workspaceMode === 'study-session' ? <TodayPage study={study} /> : <MockTodayPage />}
            </ErrorBoundary>
          ) : (
            <PageOutlet />
          )}
        </main>
      </div>
    </div>
  )
}
