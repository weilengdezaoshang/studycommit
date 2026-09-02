import { clearAuthSession, useAuthSession } from '../auth/session'
import { usePapersState } from './papers-store'

/** 设置:账户、外观与数据说明。 */
export function SettingsPage(): React.JSX.Element {
  const session = useAuthSession()
  const state = usePapersState()

  return (
    <div className="records-page">
      <h2 className="records-page__title">设置</h2>

      <section className="settings-section">
        <h3>账户</h3>
        {session ? (
          <div className="settings-account">
            <span className="settings-account__avatar">{session.user.nickname.slice(0, 1)}</span>
            <div>
              <div className="settings-account__name">{session.user.nickname}</div>
              <div className="settings-account__meta">
                登录状态正常
                {session.tokens ? ` · 令牌到期 ${session.tokens.expiresAt.slice(0, 10)}` : ''}
              </div>
            </div>
            <button type="button" className="settings-logout" onClick={() => clearAuthSession()}>
              退出登录
            </button>
          </div>
        ) : (
          <p className="settings-line">未登录</p>
        )}
      </section>

      <section className="settings-section">
        <h3>外观</h3>
        <p className="settings-line">跟随系统浅色 / 深色模式。</p>
      </section>

      <section className="settings-section">
        <h3>数据</h3>
        <p className="settings-line">
          当前为演示数据:{state.papers.length} 张纸页、{state.topics.length} 个箱子。
          纸页与箱子保存在本机,登录后将在设备之间同步。
        </p>
      </section>
    </div>
  )
}
