import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router'
import { loadNavigationPreferences } from './navigation-preferences'
import { routes } from './routes'
import { AppShell } from '../layouts/AppShell'
import { TopicLayout } from '../layouts/TopicLayout'
import { PagePlaceholder } from '../components/PagePlaceholder'

function LandingRedirect(): React.JSX.Element {
  const preferences = loadNavigationPreferences(window.localStorage)
  return <Navigate to={preferences.lastTopLevelPath} replace />
}

function TopicRedirect(): React.JSX.Element {
  const { topicId } = useParams()
  if (!topicId) return <Navigate to={routes.topics()} replace />
  const decoded = decodeURIComponent(topicId)
  const preferences = loadNavigationPreferences(window.localStorage)
  const section = preferences.lastTopicSectionById[decoded] ?? 'overview'
  const target = {
    overview: routes.topicOverview,
    notes: routes.topicNotes,
    map: routes.topicMap,
    logs: routes.topicLogs,
  }[section](decoded)
  return <Navigate to={target} replace />
}

function NoteDetailPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { topicId, noteId } = useParams()
  const decodedTopicId = topicId ? decodeURIComponent(topicId) : ''
  return (
    <section className="placeholder">
      <span className="placeholder__label">EL-202</span>
      <h2>笔记详情占位页</h2>
      <p>笔记 ID：{noteId ? decodeURIComponent(noteId) : '无效'}</p>
      <button
        type="button"
        className="button"
        onClick={() => navigate(routes.topicNotes(decodedTopicId), { replace: true })}
      >
        返回笔记列表
      </button>
    </section>
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

export function AppRoutes(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LandingRedirect />} />
        <Route
          path="today"
          element={
            <PagePlaceholder
              title="开始今天的学习"
              description="今天页将在 EL-101 接入计划、活动会话和最近记录。"
              nextTask="EL-101"
            />
          }
        />
        <Route
          path="drafts"
          element={
            <PagePlaceholder
              title="暂无待整理草稿"
              description="草稿创建、整理和归档将在 EL-201 实现。"
              nextTask="EL-201"
            />
          }
        />
        <Route
          path="topics"
          element={
            <PagePlaceholder
              title="还没有专题"
              description="专题列表与创建功能将在 EL-005 接入真实 Repository。"
              nextTask="EL-005"
            />
          }
        />
        <Route path="topics/:topicId" element={<TopicLayout />}>
          <Route index element={<TopicRedirect />} />
          <Route
            path="overview"
            element={
              <PagePlaceholder
                title="专题概览"
                description="将展示该专题的学习进度与内容摘要。"
                nextTask="EL-005"
              />
            }
          />
          <Route
            path="notes"
            element={
              <PagePlaceholder
                title="专题笔记"
                description="Markdown 笔记列表和编辑器将在 EL-202 实现。"
                nextTask="EL-202"
              />
            }
          />
          <Route path="notes/:noteId" element={<NoteDetailPage />} />
          <Route
            path="map"
            element={
              <PagePlaceholder
                title="知识地图"
                description="节点、关系和地图状态将在 EL-204 实现。"
                nextTask="EL-204"
              />
            }
          />
          <Route
            path="logs"
            element={
              <PagePlaceholder
                title="学习记录"
                description="记录查询、日期与专题筛选将在 EL-105 实现。"
                nextTask="EL-105"
              />
            }
          />
        </Route>
        <Route
          path="review"
          element={
            <PagePlaceholder
              title="暂无到期复习"
              description="复习卡片和评分流程将在 EL-203 实现。"
              nextTask="EL-203"
            />
          }
        />
        <Route
          path="settings"
          element={
            <PagePlaceholder
              title="设置尚未配置"
              description="主题、数据目录、Git 和备份等选项将在后续任务中接入。"
              nextTask="P1"
            />
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
