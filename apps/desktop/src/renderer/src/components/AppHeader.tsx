import { useLocation } from 'react-router'

function getPageTitle(pathname: string): string {
  if (pathname === '/drafts') return '草稿'
  if (pathname === '/topics') return '所有专题'
  if (pathname.startsWith('/topics/')) return '专题'
  if (pathname === '/review') return '复习'
  if (pathname === '/settings') return '设置'
  if (pathname === '/today' || pathname === '/') return '今天'
  return '页面不存在'
}

export function AppHeader(): React.JSX.Element {
  const { pathname } = useLocation()

  return (
    <header className="app-header">
      <div>
        <span className="app-header__eyebrow">StudyCommit 桌面端</span>
        <h1>{getPageTitle(pathname)}</h1>
      </div>
      <span className="local-status">
        <i aria-hidden="true" />
        本地工作
      </span>
    </header>
  )
}
