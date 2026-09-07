import { useEffect, useMemo, useState } from 'react'
import { createDesktopReviewGateway, type ReviewGateway } from './review-gateway'

type MonthCursor = { year: number; month: number }

function monthKeyOf(cursor: MonthCursor): string {
  return `${cursor.year}-${String(cursor.month).padStart(2, '0')}`
}

function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + (cursor.month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

function timezoneOf(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** 月度装订页(M5):服务端按用户时区聚合;纸页数/箱子数/解决数与逐日热力。 */
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
      .monthly({ month, timezone: timezoneOf() })
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

  const nextDisabled = (() => {
    const next = shiftMonth(cursor, 1)
    return next.year * 12 + next.month > today.getFullYear() * 12 + (today.getMonth() + 1)
  })()

  const countByDate = useMemo(
    () => new Map((review?.days ?? []).map((day) => [day.date, day.count])),
    [review],
  )
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate()
  const cells = Array.from({ length: daysInMonth }, (_, index) => {
    const dateKey = `${monthKeyOf(cursor)}-${String(index + 1).padStart(2, '0')}`
    const count = countByDate.get(dateKey) ?? 0
    return { dateKey, count }
  })

  return (
    <section className="study-page" aria-label="月度装订">
      <h2>
        {cursor.year} 年 {cursor.month} 月装订
      </h2>
      <div className="study-form__actions" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="button button--secondary"
          aria-label="上一个月"
          onClick={() => setCursor(shiftMonth(cursor, -1))}
        >
          ← 上个月
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-label="下一个月"
          disabled={nextDisabled}
          onClick={() => setCursor(shiftMonth(cursor, 1))}
        >
          下个月 →
        </button>
      </div>

      {failed ? (
        <p role="alert">装订统计暂时不可用，请稍后重试。</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
            <Stat label="纸页" value={loading ? '…' : String(review?.paperCount ?? 0)} />
            <Stat label="箱子" value={loading ? '…' : String(review?.topicCount ?? 0)} />
            <Stat label="解决" value={loading ? '…' : String(review?.resolvedCount ?? 0)} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 480 }}>
            {cells.map((cell) => (
              <div
                key={cell.dateKey}
                title={`${cell.dateKey}:${cell.count} 张`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  background:
                    cell.count <= 0
                      ? 'var(--color-surface-soft, rgba(0,0,0,0.05))'
                      : cell.count === 1
                        ? 'rgba(83, 99, 90, 0.35)'
                        : cell.count <= 3
                          ? 'rgba(83, 99, 90, 0.6)'
                          : 'rgba(83, 99, 90, 1)',
                  color: cell.count > 3 ? '#fff' : 'inherit',
                }}
              >
                {Number(cell.dateKey.slice(-2))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
      <span style={{ fontSize: 26, fontWeight: 600 }}>{value}</span>
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
    </div>
  )
}
