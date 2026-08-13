import { routes } from '../../app/routes'
import { SidebarLink } from './SidebarLink'

export function Sidebar(): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand" aria-label="StudyCommit">
        <span className="brand__mark" aria-hidden="true">S</span>
        <span>StudyCommit</span>
      </div>

      <nav className="sidebar__nav" aria-label="主导航">
        <SidebarLink to={routes.today()} label="今天" icon="today" end />
        <SidebarLink to={routes.drafts()} label="草稿" icon="drafts" end />
        <SidebarLink to={routes.topics()} label="所有专题" icon="topics" />
        <SidebarLink to={routes.review()} label="复习" icon="review" end />
      </nav>

      <div className="sidebar__footer">
        <SidebarLink to={routes.settings()} label="设置" icon="settings" end />
      </div>
    </aside>
  )
}
