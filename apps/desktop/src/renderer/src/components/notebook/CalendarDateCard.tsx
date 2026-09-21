import { useId } from 'react'
import './calendar-date-card.css'

/** 日期纸签：只呈现日期与数量；纸边是装饰，日期仍为可读文本。 */
export function CalendarDateCard({ dateKey, count }: { dateKey: string; count: number }) {
  const hatchId = useId().replace(/:/g, '')
  const date = new Date(`${dateKey}T12:00:00`)
  return (
    <header className="calendar-date-card" aria-label={date.toLocaleDateString('zh-CN')}>
      <svg
        className="calendar-date-card__paper"
        viewBox="0 0 140 224"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={hatchId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(28)"
          >
            <path d="M1 0V6" stroke="var(--color-text-muted)" strokeWidth="0.8" />
          </pattern>
        </defs>
        <path d="M12 17 130 9 137 210 19 222 6 215Z" fill={`url(#${hatchId})`} />
        <path
          d="M5 10 128 4 131 199 116 208 99 205 86 211 70 207 55 212 39 208 23 214 8 209 3 178Z"
          fill="var(--color-surface)"
          stroke="var(--color-text)"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M7 12 54 8 91 8 126 5M130 10 128 65 133 123 131 191M6 28 5 94 8 151 6 204"
          fill="none"
          stroke="var(--color-text)"
          strokeWidth="0.7"
        />
        <path
          d="m107 207 11-13 13 5"
          fill="var(--color-primary-surface)"
          stroke="var(--color-text)"
          strokeWidth="1"
        />
        <path
          d="m17 164 103-4 14 1m-97 6 76-4"
          fill="none"
          stroke="var(--color-text)"
          strokeWidth="1.2"
        />
        <path
          d="M36 16c-4-14 5-15 5-5m51 2c-4-13 6-14 6-4"
          fill="none"
          stroke="var(--color-text)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <time dateTime={dateKey} className="calendar-date-card__number">
        {Number(dateKey.slice(8))}
      </time>
      <span className="calendar-date-card__month">
        {date.getMonth() + 1}月 · {date.toLocaleDateString('zh-CN', { weekday: 'short' })}
      </span>
      <small className="calendar-date-card__count">{count} 条记录</small>
    </header>
  )
}
