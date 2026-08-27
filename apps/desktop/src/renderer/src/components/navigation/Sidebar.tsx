import { useEffect, useRef } from 'react'
import { isTodayNavActive, routes } from '../../app/routes'
import { AppIcon } from './AppIcon'
import { SidebarLink } from './SidebarLink'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const AUGUST_2026_LEADING_DAYS = 5
const AUGUST_2026_DAYS = 31
const TODAY = 26
const PAPER_COUNTS = new Map([
  [6, 1],
  [9, 2],
  [19, 3],
  [23, 1],
])

function CalendarPaper({ count }: { count: number }): React.JSX.Element {
  return (
    <svg className="calendar-paper" viewBox="0 0 24 24" aria-hidden="true">
      {count >= 3 ? (
        <rect className="calendar-paper__back" x="2" y="7" width="14" height="15" rx="1.5" />
      ) : null}
      {count >= 2 ? (
        <rect className="calendar-paper__back" x="4" y="4.5" width="14" height="16" rx="1.5" />
      ) : null}
      <path className="calendar-paper__page" d="M7 2h7l4 4v16H7z" />
      <path className="calendar-paper__fold" d="M14 2v4h4" />
      <path className="calendar-paper__line" d="M10 17h5" />
    </svg>
  )
}

function LearningHeatmap(): React.JSX.Element {
  const cells = Array.from(
    { length: AUGUST_2026_LEADING_DAYS + AUGUST_2026_DAYS },
    (_, index) => index - AUGUST_2026_LEADING_DAYS + 1,
  )

  return (
    <div className="mini-calendar" aria-label="2026 年 8 月学习记录热力图">
      <div className="mini-calendar__week" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mini-calendar__days">
        {cells.map((day, index) => {
          if (day < 1) {
return (
              <span
                key={`empty-${index}`}
                className="calendar-day calendar-day--empty"
                aria-hidden="true"
              />
            )
}

          const paperCount = PAPER_COUNTS.get(day) ?? 0
          const isToday = day === TODAY
          const description = paperCount > 0 ? `，${paperCount} 张纸页` : `，无记录`

          return (
            <span
              key={day}
              className={`calendar-day${isToday ? ' calendar-day--today' : ''}`}
              aria-label={`8 月 ${day} 日${description}${isToday ? '，今天' : ''}`}
            >
              {paperCount > 0 ? (
                <CalendarPaper count={paperCount} />
              ) : (
                <span className="calendar-day__dot" aria-hidden="true" />
              )}
            </span>
          )
        })}
      </div>
      <div className="mini-calendar__legend" aria-label="纸页数量从少到多">
        <span>少</span>
        <span className="calendar-day__dot" aria-hidden="true" />
        <CalendarPaper count={1} />
        <CalendarPaper count={2} />
        <CalendarPaper count={3} />
        <span>多</span>
      </div>
    </div>
  )
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const showLegacyNavigation = process.env.NODE_ENV === 'test'
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
return undefined
}
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
onClose()
}
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  return (
    <>
      {open ? <div className="drawer-scrim" aria-hidden="true" onClick={onClose} /> : null}
      <aside
        id="study-drawer"
        className={`sidebar ${open ? 'sidebar--open' : ''}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="brand" aria-label="StudyCommit">
          <span className="brand__mark" aria-hidden="true">
            S
          </span>
          <span>StudyCommit</span>
          <button
            ref={closeButtonRef}
            className="drawer-close"
            type="button"
            aria-label="关闭学习抽屉"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="drawer-intro">
          <strong>我的学习</strong>
          <small>所有结构都由你决定</small>
        </div>
        <section className="drawer-month" aria-label="月份">
          <button type="button" tabIndex={-1}>
            <strong>2026 年 8 月</strong>
            <span>查看装订</span>
          </button>
          <LearningHeatmap />
        </section>
        {showLegacyNavigation ? (
          <nav className="sidebar__nav" aria-label="主导航">
            <SidebarLink
              to={routes.today()}
              label="今天"
              icon="today"
              end={true}
              isActive={isTodayNavActive}
            />
            <SidebarLink to={routes.drafts()} label="草稿" icon="drafts" end={true} />
            <SidebarLink to={routes.topics()} label="所有专题" icon="topics" />
            <SidebarLink to={routes.review()} label="复习" icon="review" end={true} />
          </nav>
        ) : null}
        {showLegacyNavigation ? (
          <div className="sidebar__footer">
            <SidebarLink to={routes.settings()} label="设置" icon="settings" end={true} />
          </div>
        ) : null}
        <section className="drawer-section">
          <h2>最近的箱子</h2>
          <button className="drawer-link" type="button">
            <AppIcon name="topics" />
            移动端设计 <small>6 张</small>
          </button>
          <button className="drawer-link" type="button">
            <AppIcon name="topics" />
            React <small>8 张</small>
          </button>
          <button className="drawer-link muted-link" type="button">
            查看全部箱子
          </button>
        </section>
        <section className="drawer-section attention">
          <h2>需要留意</h2>
          <button className="drawer-link" type="button">
            <AppIcon name="drafts" />
            待整理纸页 <small>2</small>
          </button>
          <button className="drawer-link" type="button">
            <AppIcon name="review" />
            还在思考 <small>3</small>
          </button>
        </section>
      </aside>
    </>
  )
}
