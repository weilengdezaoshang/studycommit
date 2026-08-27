import { useLocation } from 'react-router'

function getPageTitle(pathname: string): string {
  if (pathname === '/drafts') {
    return '草稿'
  }
  if (pathname === '/topics') {
    return '所有专题'
  }
  if (pathname.startsWith('/topics/')) {
    return '专题'
  }
  if (pathname === '/review') {
    return '复习'
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
  const isToday = pathname === '/today' || pathname === '/'

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
          <h1>继续一个问题</h1>
        ) : (
          <div>
            <span className="app-header__eyebrow">StudyCommit 桌面端</span>
            <h1>{getPageTitle(pathname)}</h1>
          </div>
        )}
      </div>
      <span className={isToday ? 'home-question-status' : 'local-status'}>
        <i aria-hidden="true" />
        {isToday ? '还有 2 个问题在等你' : '本地工作'}
      </span>
    </header>
  )
}
