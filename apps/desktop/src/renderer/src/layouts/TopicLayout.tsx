import { NavLink, Outlet, useParams } from 'react-router'
import { routes } from '../app/routes'

export function TopicLayout(): React.JSX.Element {
  const { topicId } = useParams()
  if (!topicId) {
    throw new Error('Topic route requires topicId')
  }

  const decodedTopicId = decodeURIComponent(topicId)
  return (
    <section className="topic-layout">
      <div className="topic-context">
        <div>
          <span className="topic-context__label">当前专题 ID</span>
          <strong>{decodedTopicId}</strong>
        </div>
        <nav className="topic-tabs" aria-label="专题导航">
          <NavLink to={routes.topicOverview(decodedTopicId)}>概览</NavLink>
          <NavLink to={routes.topicNotes(decodedTopicId)}>笔记</NavLink>
          <NavLink to={routes.topicMap(decodedTopicId)}>知识地图</NavLink>
          <NavLink to={routes.topicLogs(decodedTopicId)}>学习记录</NavLink>
        </nav>
      </div>
      <Outlet />
    </section>
  )
}
