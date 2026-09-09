import { SyncPill } from './sync/SyncPill'

/**
 * V7 顶栏(R60/R61):汉堡 + StudyCommit 手写字标 + 右侧同步状态。
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
        <span className="app-header__brand">StudyCommit</span>
      </div>
      <SyncPill />
    </header>
  )
}
