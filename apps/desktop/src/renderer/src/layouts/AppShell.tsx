import { Outlet, useLocation } from 'react-router'
import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { ErrorBoundary } from '../components/feedback/ErrorBoundary'
import { Sidebar } from '../components/navigation/Sidebar'
import { NavigationPersistence } from '../app/NavigationPersistence'
import { useStudySessionController } from '@studycommit/common/study-session-react'
import { useDesktopServices } from '../features/study-session/api/DesktopServicesProvider'
import { subscribeWindowFocus } from '../features/study-session/subscribe-window-focus'
import {
  StudyControllerProvider,
  useStudyController,
} from '../features/study-session/StudyControllerProvider'
import { StudyPanelOverlay } from '../features/study-session/StudyPanelOverlay'
import { TodayPage } from '../features/study-session/pages/TodayPage'
import { papersActions } from '../features/papers/papers-store'

function PageOutlet(): React.JSX.Element {
  const location = useLocation()
  return (
    <ErrorBoundary key={location.pathname}>
      <Outlet />
    </ErrorBoundary>
  )
}

/** 活动学习存在时显示非模态面板;完成后自动收起。 */
function StudyPanelHost({ onClose }: { onClose: () => void }): React.JSX.Element | null {
  const study = useStudyController()
  if (!study || study.phase !== 'active' || !study.session) {
    return null
  }
  return <StudyPanelOverlay study={study} onClose={onClose} />
}

export function AppShell({
  workspaceMode = 'mock',
}: {
  workspaceMode?: 'mock' | 'study-session'
}): React.JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(process.env.NODE_ENV === 'test')
  const [studyPanelOpen, setStudyPanelOpen] = useState(false)
  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const closeStudyPanel = useCallback(() => setStudyPanelOpen(false), [])
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

  // 列表页空态通过事件请求打开抽屉(抽屉状态在 shell 层)
  useEffect(() => {
    const open = (): void => setDrawerOpen(true)
    window.addEventListener('studycommit:open-drawer', open)
    return () => window.removeEventListener('studycommit:open-drawer', open)
  }, [])

  // 主页「学习中 · 继续学习」入口请求打开学习面板(面板状态在 shell 层)
  useEffect(() => {
    const open = (): void => setStudyPanelOpen(true)
    window.addEventListener('studycommit:open-study', open)
    return () => window.removeEventListener('studycommit:open-study', open)
  }, [])

  // 进入工作区后拉取云端纸页与箱子;失败时界面继续使用本地数据
  useEffect(() => {
    void papersActions.loadRemote()
  }, [])

  return (
    <StudyControllerProvider controller={study}>
      <div className="app-shell">
        <NavigationPersistence />
        <Sidebar open={drawerOpen} onClose={closeDrawer} />
        <div className="workspace">
          <AppHeader drawerOpen={drawerOpen} onMenu={openDrawer} />
          <main className="content" tabIndex={-1}>
            {showToday && workspaceMode === 'study-session' ? (
              <ErrorBoundary>
                <TodayPage study={study} />
              </ErrorBoundary>
            ) : (
              /* 路由决定内容:/today 渲染纸页首页(选中日期的记录) */
              <PageOutlet />
            )}
          </main>
        </div>
        {studyPanelOpen ? <StudyPanelHost onClose={closeStudyPanel} /> : null}
      </div>
    </StudyControllerProvider>
  )
}
