import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router'
import { usePapersState, todayKey } from '../features/papers/papers-store'
import { parseDateKey } from '@studycommit/common/study-session-runtime'
import { loadNavigationPreferences } from './navigation-preferences'
import { routes } from './routes'
import { AppShell } from '../layouts/AppShell'
import { ToastProvider } from '@studycommit/common/toast-react'
import { Toast } from '../components/toast/Toast'
import { DesktopServicesProvider } from '../features/study-session/api/DesktopServicesProvider'
import { SettingsPage } from '../features/papers/SettingsPage'
import { PapersHomePage } from '../features/papers/PapersHomePage'
import { ProblemsPage } from '../features/papers/ProblemsPage'
import { RecordsListPage } from '../features/papers/RecordsListPage'
import { AuthPage } from '../features/auth/AuthPage'
import { setAuthSession, useAuthSession } from '../features/auth/session'

const DeskDemoPage = lazy(() =>
  import('../features/desk/DeskDemoPage').then((module) => ({ default: module.DeskDemoPage })),
)

function LandingRedirect(): React.JSX.Element {
  const preferences = loadNavigationPreferences(window.localStorage)
  return <Navigate to={preferences.lastTopLevelPath} replace />
}

function RecordsListPageBridge({
  title,
  emptyCopy,
  matcher,
  topicId,
}: {
  title: string
  emptyCopy: string
  matcher: (paper: import('../features/papers/view-model').PaperWithExtra) => boolean
  topicId?: string
}): React.JSX.Element {
  const state = usePapersState()
  const papers = state.papers
    .filter((paper) => !paper.deletedAt)
    .map((paper) => ({
      ...paper,
      extra: state.extras[paper.id] ?? {
        hasQuestion: false,
        isQuestionResolved: false,
        photoPath: null,
      },
    }))
    .filter((paper) => matcher(paper))
  const topicById = new Map(state.topics.map((topic) => [topic.id, topic]))

  return (
    <RecordsListPage
      key={title}
      mode={title === '待整理的纸页' ? 'inbox' : 'box'}
      title={title}
      papers={papers}
      emptyCopy={emptyCopy}
      topicId={topicId}
      topicNameOf={(paper) => {
        const topic = paper.topicId ? topicById.get(paper.topicId) : undefined
        return topic?.name ?? '待整理'
      }}
    />
  )
}

function DateRecordsBridge({ dateKey: dateKeyProp }: { dateKey?: string }): React.JSX.Element {
  const params = useParams()
  const dateKey = dateKeyProp ?? params.dateKey
  const state = usePapersState()
  const papers = state.papers
    .filter((paper) => !paper.deletedAt && paper.createdAt.slice(0, 10) === dateKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((paper) => ({
      ...paper,
      extra: state.extras[paper.id] ?? {
        hasQuestion: false,
        isQuestionResolved: false,
        photoPath: null,
      },
    }))
  const topicById = new Map(state.topics.map((topic) => [topic.id, topic]))
  const selected = dateKey ? parseDateKey(dateKey) : null

  return (
    <RecordsListPage
      mode="date"
      title={selected ? `${selected.month} 月 ${selected.day} 日 · 记录` : '记录'}
      papers={papers}
      emptyCopy="这天还没有纸页。"
      topicNameOf={(paper) => {
        const topic = paper.topicId ? topicById.get(paper.topicId) : undefined
        return topic?.name ?? '待整理'
      }}
    />
  )
}

function BoxRecordsBridge(): React.JSX.Element {
  const { topicId } = useParams()
  const state = usePapersState()
  const topic = state.topics.find((item) => item.id === topicId)
  return (
    <RecordsListPageBridge
      title={topic?.name ?? '箱子'}
      emptyCopy="这个箱子还没有纸页。"
      matcher={(paper) => paper.topicId === topicId}
      topicId={topicId}
    />
  )
}

function NotFoundPage(): React.JSX.Element {
  return (
    <section className="placeholder">
      <span className="placeholder__label">404</span>
      <h2>页面不存在</h2>
      <p>这个地址无法匹配 StudyCommit 中的页面。</p>
      <Link className="button" to={routes.today()}>
        返回今天
      </Link>
    </section>
  )
}

export function AppRoutes({
  workspaceMode = 'mock',
}: {
  workspaceMode?: 'mock' | 'study-session'
}): React.JSX.Element {
  // PRD:未登录只允许停留在登录页;登录后进入工作区。
  const session = useAuthSession()

  return (
    <DesktopServicesProvider>
      <ToastProvider renderToast={(toast) => <Toast {...toast} />}>
        <Routes>
          <Route
            path="auth"
            element={
              session ? (
                <Navigate to={routes.today()} replace />
              ) : (
                <div className="auth-viewport">
                  <AuthPage api={window.studyCommit.auth} onSession={setAuthSession} />
                </div>
              )
            }
          />
          <Route
            element={
              session ? (
                <AppShell workspaceMode={workspaceMode} />
              ) : (
                <Navigate to={routes.auth()} replace />
              )
            }
          >
            <Route index element={<LandingRedirect />} />
            <Route
              path="today"
              element={
                workspaceMode === 'study-session' ? null : (
                  <DateRecordsBridge dateKey={todayKey()} />
                )
              }
            />
            <Route path="timeline" element={<PapersHomePage />} />
            <Route path="problems" element={<ProblemsPage />} />
            <Route path="records/:dateKey" element={<DateRecordsBridge />} />
            <Route
              path="inbox"
              element={
                <RecordsListPageBridge
                  title="待整理的纸页"
                  emptyCopy="整理完成后，这里会清空。"
                  matcher={(paper) => paper.status === 'inbox'}
                />
              }
            />
            <Route path="boxes/:topicId" element={<BoxRecordsBridge />} />
            <Route
              path="desk"
              element={
                <Suspense
                  fallback={
                    <div className="desk-route-loading" role="status">
                      正在打开三维书桌…
                    </div>
                  }
                >
                  <DeskDemoPage />
                </Suspense>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </DesktopServicesProvider>
  )
}
