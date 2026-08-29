import { describe, expect, it } from 'vitest'
import {
  buildMonthCells,
  buildWeekCells,
  chunkIntoWeeks,
  formatDateLabel,
  formatMonthTitle,
  getMonthDayCount,
  parseDateKey,
  shiftDateKey,
  toDateKey,
} from './calendar'

describe('calendar', () => {
  it('闰年二月有 29 天,平年二月有 28 天', () => {
    expect(getMonthDayCount(2024, 2)).toBe(29)
    expect(getMonthDayCount(2023, 2)).toBe(28)
    expect(getMonthDayCount(2026, 8)).toBe(31)
  })

  it('月历在月初补齐周一为第一列的空白格', () => {
    // 2026-08-01 是周六,周一为第一列时应有 5 个前导空白
    const cells = buildMonthCells(2026, 8, '2026-08-25', {})
    const blanks = cells.filter((cell) => cell.isBlank)
    expect(blanks).toHaveLength(5)
    expect(cells[5].dateKey).toBe('2026-08-01')
    expect(cells[5].dayLabel).toBe('1')
  })

  it('月历格子的选中态与传入的选中日期一致', () => {
    const cells = buildMonthCells(2026, 8, '2026-08-25', {})
    const selected = cells.filter((cell) => cell.isSelected)
    expect(selected).toHaveLength(1)
    expect(selected[0].dateKey).toBe('2026-08-25')
  })

  it('月历格子的强度按计数取值且超过 3 封顶', () => {
    const counts = { '2026-08-01': 1, '2026-08-02': 3, '2026-08-03': 99 }
    const cells = buildMonthCells(2026, 8, '2026-08-01', counts)
    expect(cells.find((cell) => cell.dateKey === '2026-08-01')?.level).toBe(1)
    expect(cells.find((cell) => cell.dateKey === '2026-08-02')?.level).toBe(3)
    expect(cells.find((cell) => cell.dateKey === '2026-08-03')?.level).toBe(3)
  })

  it('月历格子按每周 7 格分块且末尾补空白', () => {
    // 2026-08:5 前导空白 + 31 天 = 36 格,补齐到 42 格共 6 行
    const weeks = chunkIntoWeeks(buildMonthCells(2026, 8, '2026-08-25', {}))
    expect(weeks).toHaveLength(6)
    weeks.forEach((week) => expect(week).toHaveLength(7))
    expect(weeks[5][0].dateKey).toBe('2026-08-31')
    expect(weeks[5][1].isBlank).toBe(true)
  })

  it('周历以锚点日期所在周为准并从周一开始', () => {
    // 2026-08-25 是周二
    const cells = buildWeekCells('2026-08-25', '2026-08-25', {})
    expect(cells).toHaveLength(7)
    expect(cells[0].dateKey).toBe('2026-08-24')
    expect(cells[6].dateKey).toBe('2026-08-30')
    expect(cells[1].isSelected).toBe(true)
  })

  it('周历按计数映射格子的数量与选中态', () => {
    const cells = buildWeekCells('2026-08-25', '2026-08-26', { '2026-08-24': 2 })
    expect(cells[0].count).toBe(2)
    expect(cells[0].isSelected).toBe(false)
    expect(cells[2].isSelected).toBe(true)
  })

  it('月份切换保留日并在目标月夹取到最后一天', () => {
    expect(shiftDateKey('2026-08-31', 1)).toBe('2026-09-30')
    expect(shiftDateKey('2026-01-15', -1)).toBe('2025-12-15')
    expect(shiftDateKey('2024-02-29', 1)).toBe('2024-03-29')
    expect(shiftDateKey('2026-08-25', 0)).toBe('2026-08-25')
  })

  it('日期键解析与序列化互为逆运算', () => {
    expect(toDateKey(parseDateKey('2026-08-25'))).toBe('2026-08-25')
    expect(parseDateKey('not-a-date')).toEqual({ year: 2026, month: 8, day: 27 })
  })

  it('月份标题与日期文案按中文格式输出', () => {
    expect(formatMonthTitle(8)).toBe('八月')
    expect(formatMonthTitle(13)).toBe('13月')
    expect(formatDateLabel({ year: 2026, month: 8, day: 25 })).toBe('8月25日')
  })
})
