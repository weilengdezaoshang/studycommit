import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { routes } from '../../app/routes'
import { PaperEmptyIllustration } from './paper-empty-illustration'
import { papersActions, usePapersState } from './papers-store'
import {
  formatMonthLabel,
  buildHomeViewModel,
  type HomeViewModel,
  type TimelineEntry,
} from './view-model'
import { PaperExplainPanel } from './PaperExplainPanel'
import { useOptionalDesktopServices } from '../study-session/api/DesktopServicesProvider'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/** 桌面首页:左侧时间线,右侧阅读器;单击卡片即直读全文,沉浸详情留给深度阅读。 */
export function PapersHomePage(): React.JSX.Element {
  const state = usePapersState()
  const vm = buildHomeViewModel(state)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const weekCount = vm.weekCells.reduce((sum, cell) => sum + cell.count, 0)
  const selected = vm.papersOfDate.find((entry) => entry.paper.id === selectedId) ?? null

  return (
    <div className="papers-page">
      <div className="papers-header">
        <h1>{formatMonthLabel(vm.selectedDateParts)}</h1>
        <span>本周纸页 · 本周 {weekCount} 张</span>
      </div>
      <WeekStrip
        vm={vm}
        onSelect={(dateKey) => {
          // 切换日期后原选中纸页通常不在新列表,清空选中回到空态阅读器
          papersActions.selectDate(dateKey)
          setSelectedId(null)
        }}
      />
      <div className="papers-body">
        <div className="papers-main">
          <Timeline vm={vm} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <TimelineReader entry={selected} />
      </div>
    </div>
  )
}

function WeekStrip({ vm, onSelect }: { vm: HomeViewModel; onSelect: (dateKey: string) => void }) {
  return (
    <div className="papers-week">
      {vm.weekCells.map((cell, index) => (
        <button
          key={cell.dateKey}
          type="button"
          aria-label={`${cell.dateKey},${cell.count} 张纸页`}
          className={`papers-week__day${cell.isSelected ? ' is-selected' : ''}`}
          onClick={() => onSelect(cell.dateKey)}
        >
          <span className="papers-week__label">{WEEKDAYS[index]}</span>
          <span className="papers-week__visual">
            {cell.count > 0 ? (
              Array.from({ length: Math.min(cell.count, 3) }, (_, layer) => {
                const base = 2.5 - (Math.min(cell.count, 3) - 1)
                return (
                  <i
                    key={layer}
                    className="papers-week__sheet"
                    style={{ transform: `translate(${base + layer * 2}px, ${base + layer * 2}px)` }}
                  />
                )
              })
            ) : (
              <i className="papers-week__dot" />
            )}
          </span>
        </button>
      ))}
    </div>
  )
}

function isOpenQuestion(entry: TimelineEntry): boolean {
  return entry.paper.extra.hasQuestion && !entry.paper.extra.isQuestionResolved
}

function Timeline({
  vm,
  selectedId,
  onSelect,
}: {
  vm: HomeViewModel
  selectedId: string | null
  onSelect: (paperId: string) => void
}) {
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)
  if (vm.papersOfDate.length === 0) {
    return (
      <div className="papers-empty">
        <PaperEmptyIllustration />
        <p className="papers-empty__title">这天还没有纸页</p>
        <p className="papers-empty__copy">空白只是留白，不是中断。</p>
      </div>
    )
  }

  /** 键盘 ↑↓ 在时间线内移动选中并直读;Enter 在已选中卡片上进沉浸详情。 */
  function handleListKeyDown(event: React.KeyboardEvent) {
    const papers = vm.papersOfDate
    if (papers.length === 0) {
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const currentIndex = papers.findIndex((entry) => entry.paper.id === selectedId)
      // 无选中时 ↓ 选第一张、↑ 选最后一张;有选中时在范围内移动
      const nextIndex =
        event.key === 'ArrowDown'
          ? currentIndex < 0
            ? 0
            : Math.min(papers.length - 1, currentIndex + 1)
          : currentIndex < 0
            ? papers.length - 1
            : Math.max(0, currentIndex - 1)
      const nextId = papers[nextIndex].paper.id
      onSelect(nextId)
      const nextCard = listRef.current?.querySelector<HTMLElement>(`[data-paper-id="${nextId}"]`)
      nextCard?.focus({ preventScroll: true })
      nextCard?.scrollIntoView({ block: 'nearest' })
    }
  }

  return (
    <div className="papers-timeline" ref={listRef} onKeyDown={handleListKeyDown}>
      {vm.papersOfDate.map((entry) => {
        const open = isOpenQuestion(entry)
        return (
          <div key={entry.paper.id} className="papers-entry">
            <div className="papers-entry__marker">
              <span className="papers-entry__dot" />
            </div>
            <div className="papers-entry__main">
              <span className="papers-entry__time">{entry.timeLabel}</span>
              <button
                type="button"
                data-paper-id={entry.paper.id}
                aria-label={`${entry.paper.content}${open ? ',仍有未解决的问题' : ''}`}
                aria-pressed={selectedId === entry.paper.id}
                className={`papers-card${selectedId === entry.paper.id ? ' is-selected' : ''}`}
                onClick={() => onSelect(entry.paper.id)}
                onKeyDown={(event) => {
                  // Enter 首次按下走默认 click 选中;已选中时再按 Enter 进沉浸详情
                  if (event.key === 'Enter' && selectedId === entry.paper.id) {
                    event.preventDefault()
                    navigate(
                      `${routes.dateRecords(entry.paper.createdAt.slice(0, 10))}?paper=${entry.paper.id}`,
                    )
                  }
                }}
                onDoubleClick={() =>
                  navigate(
                    `${routes.dateRecords(entry.paper.createdAt.slice(0, 10))}?paper=${entry.paper.id}`,
                  )
                }
              >
                <span className="papers-card__tag" style={{ backgroundColor: entry.topicColor }} />
                {open && <span className="papers-card__fold" aria-label="仍有未解决的问题" />}
                <span className="papers-card__content">{entry.paper.content}</span>
                <span className="papers-card__meta">
                  <span>{entry.topicName}</span>
                  {open && <span className="papers-card__hint">继续弄懂</span>}
                </span>
                <span
                  className="papers-card__day"
                  role="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation()
                    navigate(routes.dateRecords(entry.paper.createdAt.slice(0, 10)))
                  }}
                >
                  查看当天
                </span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** 右侧阅读器:承载原「阅读全文」之后的归箱、问题状态与 AI 解释能力。 */
function TimelineReader({ entry }: { entry: TimelineEntry | null }) {
  const navigate = useNavigate()
  const state = usePapersState()
  const services = useOptionalDesktopServices()
  const ai = services?.ai
  const [destination, setDestination] = useState('')
  const [message, setMessage] = useState('')
  const [showExplain, setShowExplain] = useState(false)
  if (!entry) {
    return (
      <aside className="papers-reader" aria-label="纸页阅读器">
        <div className="papers-reader__empty">
          <p>点左侧任意一张纸页</p>
          <p>直接在这里阅读</p>
        </div>
      </aside>
    )
  }
  const open = isOpenQuestion(entry)
  const paper = entry.paper
  async function runQuestionCommand(status: 'thinking' | 'resolved') {
    const result = await papersActions.updateQuestionStatus(paper.id, status)
    if (result === status) {
      setMessage(status === 'resolved' ? '已标记为弄懂，原来的纸页仍然保留。' : '已改回还在思考。')
    } else if (result !== null) {
      setMessage('另一台设备已更改这张纸页，已为你展示最新状态。')
    } else {
      setMessage('暂时没能更新问题状态，请稍后再试。')
    }
  }
  return (
    <aside className="papers-reader" aria-label="纸页阅读器" key={entry.paper.id}>
      <header className="papers-reader__head">
        <span className="papers-reader__dot" style={{ backgroundColor: entry.topicColor }} />
        <span className="papers-reader__topic">{entry.topicName}</span>
        <time className="papers-reader__time">
          {new Date(entry.paper.createdAt).toLocaleString('zh-CN', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </header>
      {entry.paper.extra.hasQuestion && (
        <span className={`papers-reader__state${open ? ' is-open' : ''}`}>
          {open ? '还在思考' : '这个问题，已经弄懂了'}
        </span>
      )}
      <p className="papers-reader__body">{entry.paper.content}</p>
      <div className="papers-reader__actions">
        <div className="papers-reader__organize">
          <label htmlFor="papers-reader-box">收纳到箱子</label>
          <div className="papers-reader__organize-row">
            <select
              id="papers-reader-box"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="">选择箱子</option>
              {state.topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="papers-reader__primary"
              disabled={!destination}
              onClick={() => {
                papersActions.organizePaper(entry.paper.id, destination)
                setMessage(
                  `纸页已归入「${state.topics.find((topic) => topic.id === destination)?.name}」`,
                )
                setDestination('')
              }}
            >
              归入箱子
            </button>
          </div>
        </div>
        {open && (
          <button
            type="button"
            className="papers-reader__primary"
            onClick={() => void runQuestionCommand('resolved')}
          >
            我已经弄懂了
          </button>
        )}
        {!open && entry.paper.extra.hasQuestion && (
          <button
            type="button"
            className="papers-reader__secondary"
            onClick={() => void runQuestionCommand('thinking')}
          >
            改回还在思考
          </button>
        )}
        {open && ai && !showExplain && (
          <button
            type="button"
            className="papers-reader__secondary"
            onClick={() => setShowExplain(true)}
          >
            继续弄懂
          </button>
        )}
        {open && services && showExplain && (
          <PaperExplainPanel
            paper={entry.paper}
            ai={services.ai}
            onClose={() => setShowExplain(false)}
          />
        )}
        <button
          type="button"
          className="papers-reader__secondary"
          onClick={() =>
            navigate(
              `${routes.dateRecords(entry.paper.createdAt.slice(0, 10))}?paper=${entry.paper.id}`,
            )
          }
        >
          沉浸阅读
        </button>
      </div>
      <p className="papers-reader__feedback" role="status">
        {message}
      </p>
    </aside>
  )
}
