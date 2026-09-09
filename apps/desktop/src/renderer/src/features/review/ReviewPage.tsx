import { useEffect, useMemo, useState } from 'react'
import {
  canShiftTo,
  localTimezone,
  monthKeyOf,
  monthLabelOf,
  shiftMonth,
  heatmapCells,
  type MonthCursor,
} from '@studycommit/common/review-runtime'
import { createDesktopReviewGateway, type ReviewGateway } from './review-gateway'

/** 月度装订页(M5):服务端按用户时区聚合;纸页数/主题数/解决数与逐日热力。 */
export function ReviewPage(): React.JSX.Element {
  const [gateway] = useState(() => createDesktopReviewGateway())
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState<MonthCursor>(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }))
  const [review, setReview] = useState<Awaited<ReturnType<ReviewGateway['monthly']>> | null>(null)
  const [failed, setFailed] = useState(false)
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const month = monthKeyOf(cursor)
    void gateway
      .monthly({ month, timezone: localTimezone() })
      .then((data) => {
        if (!cancelled) {
          setReview(data)
          setFailed(false)
          setLoadedMonth(month)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          setLoadedMonth(month)
        }
      })
    return () => {
      cancelled = true
    }
  }, [cursor, gateway])
  const loading = loadedMonth !== monthKeyOf(cursor)

  const nextDisabled = !canShiftTo(shiftMonth(cursor, 1), today)
  const cells = useMemo(() => heatmapCells(review?.days ?? [], cursor), [review, cursor])
  const statValue = (value: number) => (loading ? '…' : String(value))

  return (
    <section className="review-page-v7" aria-label="月度装订">
      <header className="utility-heading">
        <h2>{monthLabelOf(cursor)}装订</h2>
      </header>

      <div className="review-page-v7__controls">
        <button
          type="button"
          className="review-page-v7__shift"
          aria-label="上一个月"
          onClick={() => setCursor(shiftMonth(cursor, -1))}
        >
          ← 上个月
        </button>
        <button
          type="button"
          className="review-page-v7__shift"
          aria-label="下一个月"
          disabled={nextDisabled}
          onClick={() => setCursor(shiftMonth(cursor, 1))}
        >
          下个月 →
        </button>
      </div>

      {failed ? (
        <p className="review-page-v7__failed" role="alert">
          装订统计暂时不可用，请稍后重试。
        </p>
      ) : (
        <div className="review-page-v7__sheet">
          <div className="review-page-v7__stats">
            <Stat label="纸页" value={statValue(review?.paperCount ?? 0)} />
            <Stat label="主题" value={statValue(review?.topicCount ?? 0)} />
            <Stat label="解决" value={statValue(review?.resolvedCount ?? 0)} />
          </div>
          <div
            className="review-page-v7__grid"
            role="img"
            aria-label={`${monthLabelOf(cursor)}逐日记录数量`}
          >
            {cells.map((cell, index) => (
              <span
                key={cell.dateKey ?? `empty-${index}`}
                className={`review-page-v7__cell${cell.dateKey ? ` review-page-v7__cell--level${cell.level}` : ''}`}
                title={cell.dateKey ? `${cell.dateKey}:${cell.count} 张` : undefined}
              >
                {cell.dateKey ? Number(cell.dateKey.slice(-2)) : ''}
              </span>
            ))}
          </div>
          <p className="review-page-v7__note">热力只表示记录数量，不代表掌握程度。</p>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="review-page-v7__stat">
      <span className="review-page-v7__stat-value">{value}</span>
      <span className="review-page-v7__stat-label">{label}</span>
    </div>
  )
}
