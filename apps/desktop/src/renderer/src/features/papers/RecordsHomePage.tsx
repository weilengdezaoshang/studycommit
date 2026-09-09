import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { routes } from '../../app/routes'
import { useCaptureEntry } from '../capture/use-capture-entry'
import { papersActions, todayKey, usePapersState } from './papers-store'
import { isOpenQuestion, paperWithExtra, type PaperWithExtra } from './view-model'
import { RecordReader } from './RecordReader'

/** 记录本主页每日期默认展示条数(约两行卡片),展开按同步长增加。 */
const DAY_PAGE_SIZE = 6

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

interface DayGroup {
  dateKey: string
  dayNumber: string
  monthLabel: string
  suffix: string
  weekday: string
  papers: PaperWithExtra[]
}

/**
 * 记录本主页(V7/R34/R43/R58):默认跨月展示全部记录,
 * 日期分组 + 纸面卡片网格;≥1000px 点卡片在右侧阅读栏打开。
 */
export function RecordsHomePage({ dateKey }: { dateKey?: string }): React.JSX.Element {
  const state = usePapersState()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const detailId = searchParams.get('paper')
  const today = todayKey()
  /** 路由日期(/records/:dateKey)或抽屉点选日期;存在即只看当天(R43) */
  const activeDateKey = dateKey ?? (state.selectedDateKey || undefined)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<'recent' | 'earliest'>('recent')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all')
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')
  const capture = useCaptureEntry()

  const topicById = useMemo(
    () => new Map(state.topics.map((topic) => [topic.id, topic])),
    [state.topics],
  )

  const groups = useMemo<DayGroup[]>(() => {
    const direction = sortOrder === 'recent' ? -1 : 1
    const filtered = state.papers
      .filter((paper) => !paper.deletedAt)
      .map((paper) => paperWithExtra(state, paper))
      .filter((paper) =>
        statusFilter === 'all'
          ? true
          : statusFilter === 'open'
            ? isOpenQuestion(paper)
            : paper.extra.isQuestionResolved,
      )
      .sort((a, b) => direction * a.createdAt.localeCompare(b.createdAt))
    if (activeDateKey) {
      // R43:日期模式下只看当天
      const scoped = filtered.filter((paper) => paper.createdAt.slice(0, 10) === activeDateKey)
      return [buildDayGroup(scoped, activeDateKey, today)]
    }
    const byDay = new Map<string, PaperWithExtra[]>()
    for (const paper of filtered) {
      const dateKey = paper.createdAt.slice(0, 10)
      const bucket = byDay.get(dateKey)
      if (bucket) {
        bucket.push(paper)
      } else {
        byDay.set(dateKey, [paper])
      }
    }
    return [...byDay.keys()].map((dateKey) =>
      buildDayGroup(byDay.get(dateKey) ?? [], dateKey, today),
    )
  }, [state, statusFilter, sortOrder, today, activeDateKey])

  const total = useMemo(
    () => state.papers.filter((paper) => !paper.deletedAt).length,
    [state.papers],
  )
  const scopedTotal = useMemo(
    () => groups.reduce((sum, group) => sum + group.papers.length, 0),
    [groups],
  )

  const detailPaper = groups.flatMap((group) => group.papers).find((paper) => paper.id === detailId)

  const readButton = useRef<HTMLButtonElement>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const wasReading = useRef(false)
  useEffect(() => {
    if (detailPaper) {
      detailHeading.current?.focus()
    } else if (wasReading.current) {
      readButton.current?.focus({ preventScroll: true })
    }
    wasReading.current = Boolean(detailPaper)
  }, [detailPaper])

  function closeDetail() {
    const next = new URLSearchParams(searchParams)
    next.delete('paper')
    setSearchParams(next, { replace: true })
  }

  function openPaper(paperId: string) {
    const next = new URLSearchParams(searchParams)
    next.set('paper', paperId)
    setSearchParams(next)
  }

  const emptyBecauseFiltered = total > 0 && scopedTotal === 0
  const headingSummary = activeDateKey
    ? `${Number(activeDateKey.slice(5, 7))} 月 ${Number(activeDateKey.slice(8))} 日 · ${scopedTotal} 条记录`
    : `全部记录 · ${total} 条记录`

  return (
    <>
      <section
        className={`records-home${detailPaper ? ' records-home--reading' : ''}`}
        aria-label="记录本"
      >
        <header className="records-home__heading">
          <div>
            <h2 className="records-home__title">记录本</h2>
            <p>{headingSummary}</p>
          </div>
          <div className="records-home__actions">
            {(activeDateKey || dateKey) && (
              <button
                type="button"
                className="records-home__capture"
                onClick={() => {
                  if (dateKey) {
                    navigate(routes.timeline())
                  } else {
                    papersActions.selectDate('')
                  }
                }}
              >
                清除日期
              </button>
            )}
            <button
              type="button"
              className="records-home__capture"
              onClick={() => void capture.start()}
              disabled={capture.busy}
            >
              截图学习
            </button>
            <button
              type="button"
              className="records-home__compose"
              onClick={() => navigate(routes.compose())}
            >
              记一点
            </button>
            <button
              type="button"
              className="records-home__filter-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              筛选与排序
            </button>
          </div>
        </header>

        {capture.notice && (
          <p className="records-home__notice" role="status">
            {capture.notice}
          </p>
        )}
        {capture.permissionDenied && (
          <p className="records-home__notice" role="status">
            还没有屏幕录制权限，可以在系统设置中允许后重试；也可以先用「记一点」写下想法。
          </p>
        )}
        {message && (
          <p className="records-home__notice" role="status">
            {message}
          </p>
        )}

        {filtersOpen && (
          <div className="records-home__filters" aria-label="筛选与排序">
            <label>
              时间顺序
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as 'recent' | 'earliest')}
              >
                <option value="recent">最近在前</option>
                <option value="earliest">最早在前</option>
              </select>
            </label>
            <label>
              记录状态
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'all' | 'open' | 'resolved')
                }
              >
                <option value="all">全部状态</option>
                <option value="open">还在思考</option>
                <option value="resolved">已经弄懂</option>
              </select>
            </label>
          </div>
        )}

        {scopedTotal > 0 ? (
          groups.map((group) => (
            <DaySection
              key={group.dateKey}
              group={group}
              expanded={expandedDays[group.dateKey] ?? false}
              onToggle={() =>
                setExpandedDays((current) => ({
                  ...current,
                  [group.dateKey]: !(current[group.dateKey] ?? false),
                }))
              }
              onOpen={openPaper}
            />
          ))
        ) : (
          <div className="records-home__empty">
            <h3>{emptyBecauseFiltered ? '没有符合条件的记录' : '记录本还是空的'}</h3>
            <p>
              {emptyBecauseFiltered
                ? '换一个状态，或从抽屉的热力月历找一天看看。'
                : '想到什么就记一点，这个本子会慢慢变厚。'}
            </p>
            {!emptyBecauseFiltered && (
              <button
                type="button"
                className="records-home__compose"
                onClick={() => navigate(routes.compose())}
              >
                记下第一条
              </button>
            )}
          </div>
        )}
      </section>

      {detailPaper ? (
        <RecordReader
          paper={detailPaper}
          topicName={
            detailPaper.topicId ? (topicById.get(detailPaper.topicId)?.name ?? '待整理') : '待整理'
          }
          topics={state.topics}
          headingRef={detailHeading}
          closeButtonRef={readButton}
          onClose={closeDetail}
          onNotice={setMessage}
        />
      ) : null}
    </>
  )
}

function buildDayGroup(papers: PaperWithExtra[], dateKey: string, today: string): DayGroup {
  const date = new Date(`${dateKey}T00:00:00`)
  return {
    dateKey,
    dayNumber: dateKey.slice(8),
    monthLabel: `${date.getMonth() + 1} 月`,
    weekday: `周${WEEKDAY_NAMES[date.getDay()]}`,
    suffix: dateKey === today ? '今天' : `${date.getFullYear()} 年`,
    papers,
  }
}

/** 单日分组:标题 + 卡片网格 + 超出默认条数时的步进展开。 */
function DaySection({
  group,
  expanded,
  onToggle,
  onOpen,
}: {
  group: DayGroup
  expanded: boolean
  onToggle: () => void
  onOpen: (paperId: string) => void
}): React.JSX.Element {
  const visible = expanded ? group.papers : group.papers.slice(0, DAY_PAGE_SIZE)
  const fullDate = `${group.dateKey.slice(0, 4)} 年 ${Number(group.dateKey.slice(5, 7))} 月 ${Number(group.dateKey.slice(8))} 日 ${group.weekday.replace('周', '星期')}`
  return (
    <section className="records-home__day" aria-label={fullDate}>
      <header className="records-home__day-heading">
        <h3>
          <span className="records-home__day-number" aria-hidden="true">
            {group.dayNumber}
          </span>
          <span className="records-home__day-meta">
            {group.monthLabel} · {group.weekday}
            <span className="records-home__day-suffix">{group.suffix}</span>
          </span>
          <span className="visually-hidden">{fullDate}</span>
        </h3>
        <span className="records-home__day-count">{group.papers.length} 条记录</span>
      </header>
      <div className="records-home__grid">
        {visible.map((paper) => (
          <RecordCard key={paper.id} paper={paper} onOpen={onOpen} />
        ))}
      </div>
      {group.papers.length > DAY_PAGE_SIZE && (
        <button
          type="button"
          className="records-home__expand"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {expanded ? '收起这一天的记录' : `展开其余 ${group.papers.length - DAY_PAGE_SIZE} 条`}
        </button>
      )}
    </section>
  )
}

function RecordCard({
  paper,
  onOpen,
}: {
  paper: PaperWithExtra
  onOpen: (paperId: string) => void
}): React.JSX.Element {
  const open = isOpenQuestion(paper)
  return (
    <article className="record-card">
      <span className="record-card__scribble" aria-hidden="true" />
      <time>{paper.createdAt.slice(11, 16)}</time>
      <button
        type="button"
        className="record-card__body"
        aria-label={`打开记录：${paper.content.slice(0, 40)}`}
        onClick={() => onOpen(paper.id)}
      >
        {paper.content}
      </button>
      <footer className="record-card__meta">
        {open && <span className="record-card__chip">待解</span>}
        {!open && paper.extra.isQuestionResolved && (
          <span className="record-card__chip record-card__chip--done">已解决</span>
        )}
        {paper.understandingText && (
          <span className="record-card__understanding">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v10H9l-5 4z" />
            </svg>
            理解
          </span>
        )}
      </footer>
    </article>
  )
}
