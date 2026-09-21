import { Link } from 'react-router'
import { SyncPill } from './sync/SyncPill'
import './notebook/notebook-header.css'

/**
 * 顶栏保留抽屉入口、返回记录本的字标与同步状态；工具入口放入抽屉。
 * 页面标题交给各页面自身的内容标题(如"记录本"),顶栏不再重复。
 */
export function AppHeader({
  drawerOpen,
  onMenu,
}: {
  drawerOpen: boolean
  onMenu: () => void
}): React.JSX.Element {
  return (
    <header className="app-header">
      <div className="app-header__main">
        <button
          className="app-header__menu"
          type="button"
          aria-label="打开我的抽屉"
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
        <Link to="/timeline" className="app-header__brand" aria-label="StudyCommit，返回记录本">
          StudyCommit
        </Link>
      </div>
      <div className="notebook-header-actions">
        <SyncPill />
      </div>
    </header>
  )
}
