import { useLocation } from 'react-router'
import { usePapersState } from '../features/papers/papers-store'
import { SyncPill } from './sync/SyncPill'

function getPageTitle(
  pathname: string,
  topicNameOf: (topicId: string) => string | undefined,
): string {
  if (pathname.startsWith('/boxes/')) {
    try {
      return topicNameOf(decodeURIComponent(pathname.slice('/boxes/'.length))) ?? '纸页箱子'
    } catch {
      return '纸页箱子'
    }
  }
  if (pathname === '/inbox') {
    return '待整理的纸页'
  }
  if (pathname === '/problems') {
    return '还在思考的问题'
  }
  if (pathname === '/timeline') {
    return '纸页时间线'
  }
  if (pathname.startsWith('/records/')) {
    return '当日记录'
  }
  if (pathname === '/desk') {
    return '成长书桌'
  }
  if (pathname === '/settings') {
    return '设置'
  }
  if (pathname === '/today' || pathname === '/') {
    return '今天'
  }
  return '页面不存在'
}

export function AppHeader({
  drawerOpen,
  onMenu,
}: {
  drawerOpen: boolean
  onMenu: () => void
}): React.JSX.Element {
  const { pathname } = useLocation()
  const papers = usePapersState()
  const problemCount = papers.papers.filter((paper) => {
    if (paper.deletedAt) {
      return false
    }
    const extra = papers.extras[paper.id]
    return extra?.hasQuestion && !extra.isQuestionResolved
  }).length
  const isToday = pathname === '/today' || pathname === '/'
  const topicNameOf = (topicId: string) => papers.topics.find((topic) => topic.id === topicId)?.name

  return (
    <header className={`app-header${isToday ? ' app-header--today' : ''}`}>
      <div className="app-header__main">
        <button
          className="app-header__menu"
          type="button"
          aria-label="打开学习抽屉"
          aria-controls="study-drawer"
          aria-expanded={drawerOpen}
          onClick={onMenu}
        >
          <span className="menu-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        {isToday ? (
          <h1>纸页时间线</h1>
        ) : (
          <div>
            <span className="app-header__eyebrow">StudyCommit 桌面端</span>
            <h1>{getPageTitle(pathname, topicNameOf)}</h1>
          </div>
        )}
      </div>
      {isToday && (
        <span className="home-question-status">
          <i aria-hidden="true" />
          {problemCount} 个问题在等你
        </span>
      )}
      <SyncPill />
    </header>
  )
}
