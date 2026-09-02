import { useEffect, useRef, useState } from 'react'
import {
  buildMonthCells,
  chunkIntoWeeks,
  parseDateKey,
  shiftDateKey,
} from '@studycommit/common/study-session-runtime'
import { routes } from '../../app/routes'
import { useNavigate } from 'react-router'
import { AppIcon } from './AppIcon'
import { papersActions, usePapersState } from '../../features/papers/papers-store'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
function currentCursor() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

const WHEEL_ROW_HEIGHT = 40
const WHEEL_YEAR_START = 1900
const WHEEL_YEAR_COUNT = 191

function BoxSection({
  onSelectBox,
}: {
  onSelectBox: (topicId: string) => void
}): React.JSX.Element {
  const state = usePapersState()

  return (
    <section className="drawer-section" aria-label="我的箱子">
      <div className="drawer-section__heading">
        <h2>我的箱子</h2>
        <button
          type="button"
          className="drawer-add"
          aria-label="新建箱子并打开"
          onClick={() => {
            const topic = papersActions.createTopic(`未命名的知识 ${state.topics.length + 1}`)
            onSelectBox(topic.id)
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      {state.topics.map((topic) => {
        const count = state.papers.filter(
          (paper) => !paper.deletedAt && paper.topicId === topic.id,
        ).length
        return (
          <button
            key={topic.id}
            type="button"
            className="drawer-link"
            aria-label={`打开${topic.name}箱子`}
            onClick={() => onSelectBox(topic.id)}
          >
            <AppIcon name="box" />
            {topic.name}
            <span className="drawer-count">{count}</span>
          </button>
        )
      })}
      {state.topics.length === 0 && <p className="drawer-empty-hint">还没有箱子，点 + 建一个。</p>}
    </section>
  )
}

function LearningHeatmap({ onClose }: { onClose: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  const papers = usePapersState()
  const [cursor, setCursor] = useState(currentCursor)
  const selectedDateKey = papers.selectedDateKey

  // 热力图计数直接来自真实纸页数据,保证与首页时间轴一致
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
  }

  const weeks = chunkIntoWeeks(
    buildMonthCells(cursor.year, cursor.month, selectedDateKey, countByDate),
  )

  return (
    <div
      className="drawer-calendar"
      aria-label={`${cursor.year} 年 ${cursor.month} 月学习记录热力图`}
    >
      <nav className="drawer-section" aria-label="工作区">
        <button
          type="button"
          className="drawer-link"
          aria-label="回到工作台"
          onClick={() => {
            onClose()
            navigate('/today')
          }}
        >
          <AppIcon name="today" />
          工作台
        </button>
      </nav>
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
          className="month-label month-label--button"
          aria-label="选择年月"
          onClick={() => {
            setDraft({ year: cursor.year, month: cursor.month })
            setWheelOpen(true)
          }}
        >
          {cursor.year} 年 {cursor.month} 月
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
        <span className="month-spacer" />
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
          {week.map((cell) =>
            cell.isBlank ? (
              <span
                key={cell.dateKey}
                className="calendar-cell calendar-cell--blank"
                aria-hidden="true"
              />
            ) : (
              <button
                key={cell.dateKey}
                type="button"
                aria-label={`${cell.dateKey.slice(5, 7).replace(/^0/, '')} 月 ${Number(cell.dateKey.slice(8))} 日，${cell.count} 张纸页`}
                onClick={() => {
                  papersActions.selectDate(cell.dateKey)
                  onClose()
                  navigate(routes.timeline())
                }}
                className={`calendar-cell${cell.isSelected ? ' calendar-cell--selected' : ''}`}
              >
                {cell.count > 0 ? (
                  <span className="calendar-paper-visual">
                    {[2, 1, 0]
                      .filter((layer) => layer < Math.min(cell.count, 3))
                      .map((layer) => {
                        const base = 3 - (Math.min(cell.count, 3) - 1)
                        return (
                          <span
                            key={layer}
                            className="calendar-paper"
                            style={{ left: base + layer * 2, top: base + layer * 2 }}
                          />
                        )
                      })}
                  </span>
                ) : (
                  <span className="calendar-day__dot" aria-hidden="true" />
                )}
              </button>
            ),
          )}
        </div>
      ))}

      <div className="mini-calendar__legend" aria-label="纸页数量从少到多">
        <span>少</span>
        <span className="calendar-day__dot" aria-hidden="true" />
        {[1, 2, 3].map((count) => (
          <span key={count} className="calendar-paper-visual">
            {[...Array(count).keys()].reverse().map((layer) => {
              const base = 3 - (count - 1)
              return (
                <span
                  key={layer}
                  className="calendar-paper"
                  style={{ left: base + layer * 2, top: base + layer * 2 }}
                />
              )
            })}
          </span>
        ))}
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
        <div className="brand" aria-label="StudyCommit">
          <span className="brand__mark" aria-hidden="true">
            S
          </span>
          <span>StudyCommit</span>
          <button
            ref={closeButtonRef}
            className="drawer-close"
            type="button"
            aria-label="打开设置"
            onClick={() => {
              onClose()
              navigate(routes.settings())
            }}
          >
            <AppIcon name="settings" />
          </button>
        </div>

        <LearningHeatmap onClose={onClose} />

        <BoxSection
          onSelectBox={(topicId) => navigateAndClose(`/boxes/${encodeURIComponent(topicId)}`)}
        />
        <section className="drawer-section" aria-label="需要留意">
          <div className="drawer-section__heading">
            <h2>需要留意</h2>
          </div>
          <button type="button" className="drawer-link" onClick={() => navigateAndClose('/inbox')}>
            <AppIcon name="inbox-tray" />
            待整理的纸页
            <span className="drawer-count">{inboxCount}</span>
          </button>
          <button
            type="button"
            className="drawer-link"
            onClick={() => {
              onClose()
              navigate('/problems')
            }}
          >
            <AppIcon name="history" />
            还在思考的问题
            <span className="drawer-count">{problemsCount}</span>
          </button>
        </section>
      </aside>
    </>
  )
}
