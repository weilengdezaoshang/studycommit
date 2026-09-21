import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalendarDateCard } from './CalendarDateCard'

describe('CalendarDateCard', () => {
  it('用可读文本展示日期星期和记录数量', () => {
    render(<CalendarDateCard dateKey="2026-09-16" count={1234} />)
    expect(screen.getByText('16')).toHaveAttribute('datetime', '2026-09-16')
    expect(screen.getByText('9月 · 周三')).toBeVisible()
    expect(screen.getByText('1234 条记录')).toBeVisible()
  })
  it('多个纸签使用独立排线标识且装饰不进入无障碍树', () => {
    const { container } = render(
      <>
        <CalendarDateCard dateKey="2026-09-15" count={0} />
        <CalendarDateCard dateKey="2026-09-16" count={2} />
      </>,
    )
    const patterns = [...container.querySelectorAll('pattern')]
    expect(new Set(patterns.map((pattern) => pattern.id)).size).toBe(2)
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2)
  })
})
