import { useNavigate } from 'react-router'
import { routes } from '../../app/routes'
import { PaperEmptyIllustration } from './paper-empty-illustration'
import { papersActions, usePapersState } from './papers-store'
import { formatMonthLabel, buildHomeViewModel, type HomeViewModel } from './view-model'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/** 桌面首页:显示当前选中日期的记录;筛选来自抽屉的箱子/待整理选择。 */
export function PapersHomePage(): React.JSX.Element {
  const state = usePapersState()
  const vm = buildHomeViewModel(state)

  const weekCount = vm.weekCells.reduce((sum, cell) => sum + cell.count, 0)

  return (
    <div className="papers-page">
      <div className="papers-header">
        <h1>{formatMonthLabel(vm.selectedDateParts)}</h1>
        <span>本周纸页 · 本周 {weekCount} 张</span>
      </div>
      <WeekStrip vm={vm} onSelect={(dateKey) => papersActions.selectDate(dateKey)} />
      <Timeline vm={vm} />
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

function Timeline({ vm }: { vm: HomeViewModel }) {
  const navigate = useNavigate()
  if (vm.papersOfDate.length === 0) {
    return (
      <div className="papers-empty">
        <PaperEmptyIllustration />
        <p className="papers-empty__title">这天还没有纸页</p>
        <p className="papers-empty__copy">空白只是留白，不是中断。</p>
      </div>
    )
  }

  return (
    <div className="papers-timeline">
      {vm.papersOfDate.map((entry) => (
        <div key={entry.paper.id} className="papers-entry">
          <div className="papers-entry__marker">
            <span className="papers-entry__dot" />
          </div>
          <div className="papers-entry__main">
            <span className="papers-entry__time">{entry.timeLabel}</span>
            <button
              type="button"
              aria-label={`${entry.paper.content}${entry.paper.extra.hasQuestion && !entry.paper.extra.isQuestionResolved ? ',仍有未解决的问题' : ''}`}
              className="papers-card"
              onClick={() => navigate(routes.dateRecords(entry.paper.createdAt.slice(0, 10)))}
            >
              <span className="papers-card__tag" style={{ backgroundColor: entry.topicColor }} />
              {entry.paper.extra.hasQuestion && !entry.paper.extra.isQuestionResolved && (
                <span className="papers-card__fold" aria-label="仍有未解决的问题" />
              )}
              <span className="papers-card__content">{entry.paper.content}</span>
              <span className="papers-card__meta">
                <span>{entry.topicName}</span>
                {entry.paper.extra.hasQuestion && !entry.paper.extra.isQuestionResolved && (
                  <span className="papers-card__hint" onClick={() => navigate('/problems')}>
                    继续弄懂
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
