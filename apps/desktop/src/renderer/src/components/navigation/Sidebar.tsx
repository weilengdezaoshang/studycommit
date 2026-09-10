import { useEffect, useRef, useState } from 'react'
import {
  buildMonthCells,
  chunkIntoWeeks,
  parseDateKey,
  shiftDateKey,
} from '@studycommit/common/study-session-runtime'
import {
  normalizeTopicName,
  TOPIC_NAME_ERROR_MESSAGE,
} from '@studycommit/common/topic-store-runtime'
import { routes } from '../../app/routes'
import { useNavigate } from 'react-router'
import { AppIcon } from './AppIcon'
import { papersActions, todayKey, usePapersState } from '../../features/papers/papers-store'
import { useAuthSession } from '../../features/auth/session'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
function currentCursor() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

const WHEEL_ROW_HEIGHT = 40
const WHEEL_YEAR_START = 1900
const WHEEL_YEAR_COUNT = 191

/** R47 保留字:与现有路由语义冲突的系统范围名称。 */
const RESERVED_TOPIC_NAMES = new Set(['all', 'inbox', 'questions'])

function countTier(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) {
    return 0
  }
  if (count === 1) {
    return 1
  }
  if (count <= 4) {
    return 2
  }
  if (count <= 9) {
    return 3
  }
  return 4
}

/** 身份区(R45):头像、名字与状态;搜索与设置并列 44px 图标钮。 */
function DrawerIdentity({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const session = useAuthSession()
  const name = session?.user.nickname ?? '登录 / 注册'
  const status = session ? '已登录 · 本机与云端同步' : '未登录 · 本机记录'
  // R45:头像图片优先,加载失败回退默认图形
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string | null>(null)
  const avatarUrl = session?.user.avatarUrl ?? null
  const showAvatarImage = Boolean(avatarUrl) && brokenAvatarUrl !== avatarUrl
  return (
    <div className="drawer-identity">
      <span className="drawer-avatar" aria-hidden="true">
        {showAvatarImage && avatarUrl ? (
          <img
            className="drawer-avatar-img"
            src={avatarUrl}
            alt=""
            onError={() => setBrokenAvatarUrl(avatarUrl)}
          />
        ) : session ? (
          session.user.nickname.slice(0, 1)
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="9" r="3.2" />
            <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
          </svg>
        )}
      </span>
      <button
        type="button"
        className="drawer-auth"
        onClick={() => {
          onClose()
          navigate(session ? routes.settings() : routes.auth())
        }}
      >
        <span className="drawer-auth-name">{name}</span>
        <span className="drawer-auth-status">{status}</span>
      </button>
      <button
        type="button"
        className="drawer-icon-action"
        aria-label="搜索记录与主题"
        onClick={() => {
          onClose()
          navigate('/search')
        }}
      >
        <AppIcon name="search" />
      </button>
      <button
        type="button"
        className="drawer-icon-action"
        aria-label="个人设置"
        onClick={() => {
          onClose()
          navigate(routes.settings())
        }}
      >
        <AppIcon name="settings" />
      </button>
    </div>
  )
}

/** 热力月历(R38/R43/R52):五档底色、今天描边、点日期直达;统计行加按需图例。 */
function LearningHeatmap({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const papers = usePapersState()
  const [cursor, setCursor] = useState(currentCursor)
  const [helpOpen, setHelpOpen] = useState(false)
  const selectedDateKey = papers.selectedDateKey
  const today = todayKey()

  const countByDate: Record<string, number> = {}
  for (const paper of papers.papers) {
    if (paper.deletedAt) {
      continue
    }
    const dateKey = paper.createdAt.slice(0, 10)
    countByDate[dateKey] = (countByDate[dateKey] ?? 0) + 1
  }
  const [wheelOpen, setWheelOpen] = useState(false)
  const [draft, setDraft] = useState({ year: cursor.year, month: cursor.month })
  const yearColumnRef = useRef<HTMLDivElement>(null)
  const monthColumnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wheelOpen) {
      return
    }
    if (yearColumnRef.current) {
      yearColumnRef.current.scrollTop = (draft.year - WHEEL_YEAR_START) * WHEEL_ROW_HEIGHT
    }
    if (monthColumnRef.current) {
      monthColumnRef.current.scrollTop = (draft.month - 1) * WHEEL_ROW_HEIGHT
    }
    // 仅在打开时按当前草稿定位,滚动过程中的位置交给 onScroll 回填
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelOpen])

  const shiftMonth = (delta: number) => {
    const anchor = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-15`
    setCursor(parseDateKey(shiftDateKey(anchor, delta)))
    // R52:切月重新收起图例
    setHelpOpen(false)
  }

  const monthPrefix = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`
  const weeks = chunkIntoWeeks(
    buildMonthCells(cursor.year, cursor.month, selectedDateKey, countByDate),
  )
  const monthTotal = Object.entries(countByDate)
    .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
    .reduce((total, [, count]) => total + count, 0)
  const monthDays = Object.keys(countByDate).filter((dateKey) =>
    dateKey.startsWith(monthPrefix),
  ).length

  return (
    <div
      className="drawer-calendar"
      aria-label={`${cursor.year} 年 ${cursor.month} 月学习记录热力图`}
    >
      <div className="drawer-month-nav">
        <button
          type="button"
          className="month-shift"
          aria-label="上一个月"
          onClick={() => shiftMonth(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="month-label month-label--button drawer-hand"
          aria-label="选择年月"
          onClick={() => {
            setDraft({ year: cursor.year, month: cursor.month })
            setWheelOpen(true)
          }}
        >
          {cursor.year} 年 · {cursor.month} 月
        </button>
        <button
          type="button"
          className="month-shift"
          aria-label="下一个月"
          onClick={() => shiftMonth(1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m10 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      {wheelOpen && (
        <>
          <div className="wheel-backdrop" role="presentation" onClick={() => setWheelOpen(false)} />
          <div className="wheel-popover" role="dialog" aria-label="选择年月">
            <div className="wheel-popover__head">
              <span>选择年月</span>
              <button
                type="button"
                onClick={() => {
                  setCursor({ year: draft.year, month: draft.month })
                  setWheelOpen(false)
                }}
              >
                完成
              </button>
            </div>
            <p className="wheel-popover__preview" aria-live="polite">
              {draft.year} 年 {draft.month} 月
            </p>
            <div className="wheel-columns">
              <div
                className="wheel-column"
                role="listbox"
                aria-label="年份"
                tabIndex={0}
                onScroll={(event) => {
                  const index = Math.round(event.currentTarget.scrollTop / WHEEL_ROW_HEIGHT)
                  const year = WHEEL_YEAR_START + Math.max(0, Math.min(WHEEL_YEAR_COUNT - 1, index))
                  setDraft((value) => (value.year === year ? value : { ...value, year }))
                }}
                ref={yearColumnRef}
              >
                {Array.from({ length: WHEEL_YEAR_COUNT }, (_, index) => {
                  const year = WHEEL_YEAR_START + index
                  return (
                    <button
                      key={year}
                      type="button"
                      role="option"
                      aria-selected={year === draft.year}
                      className={`wheel-row${year === draft.year ? ' is-selected' : ''}`}
                      onClick={() => setDraft((value) => ({ ...value, year }))}
                    >
                      {year} 年
                    </button>
                  )
                })}
              </div>
              <div
                className="wheel-column"
                role="listbox"
                aria-label="月份"
                tabIndex={0}
                onScroll={(event) => {
                  const index = Math.round(event.currentTarget.scrollTop / WHEEL_ROW_HEIGHT)
                  const month = Math.max(1, Math.min(12, index + 1))
                  setDraft((value) => (value.month === month ? value : { ...value, month }))
                }}
                ref={monthColumnRef}
              >
                {Array.from({ length: 12 }, (_, index) => {
                  const month = index + 1
                  return (
                    <button
                      key={month}
                      type="button"
                      role="option"
                      aria-selected={month === draft.month}
                      className={`wheel-row${month === draft.month ? ' is-selected' : ''}`}
                      onClick={() => setDraft((value) => ({ ...value, month }))}
                    >
                      {month} 月
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="wheel-popover__hint">上下滚动选择 · 点击外侧取消</p>
          </div>
        </>
      )}

      <div className="mini-calendar__week" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="mini-calendar__days">
          {week.map((cell) => {
            if (cell.isBlank) {
              return (
                <span
                  key={cell.dateKey}
                  className="calendar-cell calendar-cell--blank"
                  aria-hidden="true"
                />
              )
            }
            const isFuture = cell.dateKey > today
            const tier = countTier(cell.count)
            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled={isFuture}
                aria-label={`${cell.dateKey.slice(0, 4)}年${cell.dateKey.slice(5, 7).replace(/^0/, '')}月${Number(cell.dateKey.slice(8))}日，${cell.count} 条记录${cell.dateKey === today ? '，今天' : ''}${isFuture ? '，未来日期' : ''}`}
                aria-pressed={cell.isSelected}
                onClick={() => {
                  papersActions.selectDate(cell.dateKey)
                  onClose()
                  navigate(routes.timeline())
                }}
                className={[
                  'calendar-cell',
                  `calendar-cell--tier${tier}`,
                  cell.isSelected ? 'calendar-cell--selected' : '',
                  cell.dateKey === today ? 'calendar-cell--today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {Number(cell.dateKey.slice(8))}
              </button>
            )
          })}
        </div>
      ))}

      <div className="drawer-month-summary">
        <p className="drawer-hand">
          本月记录 {monthTotal} 条 · 分布在 {monthDays} 天
        </p>
        <button
          type="button"
          className="drawer-help"
          aria-label="颜色含义说明"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((value) => !value)}
        >
          ?
        </button>
      </div>
      {helpOpen && (
        <p className="drawer-month-help" role="note">
          底色越深表示当天记录越多；点一个日期可以直接查看那一天的记录。
        </p>
      )}
    </div>
  )
}

/** 我的主题(R47):就地新建,输入自动聚焦,Enter 提交,取消留在抽屉。 */
function TopicSection({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const state = usePapersState()
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (creating) {
      inputRef.current?.focus()
    }
  }, [creating])

  // R47:成功持久化后焦点回到加号
  const resetDraft = () => {
    setDraftName('')
    setError(null)
    setCreating(false)
    addButtonRef.current?.focus()
  }

  const submitTopic = () => {
    const name = normalizeTopicName(draftName)
    if (!name) {
      setError(TOPIC_NAME_ERROR_MESSAGE)
      return
    }
    if (RESERVED_TOPIC_NAMES.has(name.toLowerCase())) {
      setError('这个名称被系统保留了')
      return
    }
    const duplicated = state.topics.some((topic) => topic.name.toLowerCase() === name.toLowerCase())
    if (duplicated) {
      setError('已经有同名的主题了')
      return
    }
    papersActions.createTopic(name)
    resetDraft()
  }

  return (
    <section className="drawer-section" aria-label="我的主题">
      <div className="drawer-section__heading">
        <h2 className="drawer-hand">我的主题</h2>
        <button
          ref={addButtonRef}
          type="button"
          className="drawer-add"
          aria-label="新建主题"
          onClick={() => {
            setCreating(true)
            setError(null)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      {creating && (
        <form
          className="drawer-topic-create"
          onSubmit={(event) => {
            event.preventDefault()
            submitTopic()
          }}
        >
          <input
            ref={inputRef}
            value={draftName}
            maxLength={18}
            placeholder="主题名称（最多 18 字）"
            aria-label="主题名称"
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setDraftName(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                resetDraft()
              }
            }}
          />
          {error && (
            <span className="drawer-topic-error" role="alert">
              {error}
            </span>
          )}
        </form>
      )}
      {state.topics.map((topic) => {
        const count = state.papers.filter(
          (paper) => !paper.deletedAt && paper.topicId === topic.id,
        ).length
        return (
          <button
            key={topic.id}
            type="button"
            className="drawer-link drawer-hand"
            aria-label={`打开${topic.name}主题`}
            onClick={() => {
              onClose()
              navigate(`/boxes/${encodeURIComponent(topic.id)}`)
            }}
          >
            <AppIcon name="box" />
            {topic.name}
            <span className="drawer-count">{count}</span>
          </button>
        )
      })}
      {state.topics.length === 0 && !creating && (
        <p className="drawer-empty-hint">还没有主题，点 + 建一个。</p>
      )}
    </section>
  )
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const papers = usePapersState()
  const inboxCount = papers.papers.filter(
    (paper) => !paper.deletedAt && paper.status === 'inbox',
  ).length
  const problemsCount = papers.papers.filter((paper) => {
    if (paper.deletedAt) {
      return false
    }
    const extra = papers.extras[paper.id]
    return extra?.hasQuestion && !extra.isQuestionResolved
  }).length

  const navigateAndClose = (path: string) => {
    onClose()
    navigate(path)
  }

  useEffect(() => {
    if (!open) {
      return undefined
    }
    // R45:打开抽屉首焦点为搜索;Esc 或遮罩关闭
    const searchButton = document.querySelector<HTMLButtonElement>(
      '#study-drawer .drawer-icon-action',
    )
    searchButton?.focus()
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
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || !open) {
            return
          }
          const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])',
          )
          if (focusable.length === 0) {
            return
          }
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        <DrawerIdentity onClose={onClose} />

        <nav className="drawer-section" aria-label="工作区">
          <button
            type="button"
            className="drawer-link drawer-hand"
            aria-label="打开记录本"
            aria-current="page"
            onClick={() => navigateAndClose(routes.timeline())}
          >
            <AppIcon name="today" />
            记录本
          </button>
        </nav>

        <LearningHeatmap onClose={onClose} />

        <TopicSection onClose={onClose} />

        <section className="drawer-section" aria-label="需要留意">
          <div className="drawer-section__heading">
            <h2 className="drawer-hand">需要留意</h2>
          </div>
          <button
            type="button"
            className="drawer-link drawer-hand"
            onClick={() => navigateAndClose(routes.inbox())}
          >
            <AppIcon name="inbox-tray" />
            待整理
            <span className="drawer-count">{inboxCount}</span>
          </button>
          <button
            type="button"
            className="drawer-link drawer-hand"
            onClick={() => navigateAndClose(routes.problems())}
          >
            <AppIcon name="history" />
            还在思考
            <span className="drawer-count">{problemsCount}</span>
          </button>
        </section>
      </aside>
    </>
  )
}
