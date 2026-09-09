import { clearAuthSession, useAuthSession } from '../auth/session'
import { usePapersState } from './papers-store'

/**
 * 设置(V7/R61):一张纸面承载 我的空间、外观与动效、数据与同步、关于。
 * 未接入的能力保持明确说明,不提供看似可用的控件。
 */
export function SettingsPage(): React.JSX.Element {
  const session = useAuthSession()
  const state = usePapersState()
  const paperCount = state.papers.filter((paper) => !paper.deletedAt).length

  return (
    <div className="settings-page-v7">
      <header className="utility-heading">
        <h2>设置</h2>
      </header>

      <div className="settings-sheet">
        <section aria-label="我的空间" className="settings-sheet__section">
          <h3>我的空间</h3>
          {session ? (
            <div className="settings-sheet__identity">
              <span className="settings-sheet__avatar" aria-hidden="true">
                {session.user.nickname.slice(0, 1)}
              </span>
              <div>
                <p className="settings-sheet__name">{session.user.nickname}</p>
                <p className="settings-sheet__note">
                  登录状态正常
                  {session.tokens ? ` · 令牌到期 ${session.tokens.expiresAt.slice(0, 10)}` : ''}
                </p>
                <button
                  type="button"
                  className="settings-sheet__text-action"
                  onClick={() => clearAuthSession()}
                >
                  退出登录
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-sheet__identity">
              <span className="settings-sheet__avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="9" r="3.2" />
                  <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
                </svg>
              </span>
              <div>
                <p className="settings-sheet__name">未登录 · 本机记录</p>
                <p className="settings-sheet__note">登录后，记录会在设备之间同步。</p>
              </div>
            </div>
          )}
        </section>

        <section aria-label="外观与动效" className="settings-sheet__section">
          <h3>外观与动效</h3>
          <div className="settings-sheet__row">
            <span className="settings-sheet__swatch" aria-hidden="true" />
            <div>
              <p className="settings-sheet__name">雾蓝 · 手绘纸面</p>
              <p className="settings-sheet__note">霞鹜文楷搭配清晰正文，深色主题尚未提供。</p>
            </div>
          </div>
          <p className="settings-sheet__note">
            减少动态效果跟随系统「减弱动态」设置；界面仅在必要时使用轻过渡。
          </p>
        </section>

        <section aria-label="数据与同步" className="settings-sheet__section">
          <h3>数据与同步</h3>
          <p className="settings-sheet__name">
            {paperCount} 条记录 · {state.topics.length} 个主题
          </p>
          <p className="settings-sheet__note">
            {state.source === 'server'
              ? '记录已与服务端同步；跨设备冲突以版本为准。'
              : '记录保存在本机；登录后将在设备之间同步。导入与备份恢复尚未接入。'}
          </p>
        </section>

        <section aria-label="关于 StudyCommit" className="settings-sheet__section">
          <h3>关于 StudyCommit</h3>
          <p className="settings-sheet__note">记录、整理、建立链接，再回到自己的思考。</p>
        </section>
      </div>
    </div>
  )
}
