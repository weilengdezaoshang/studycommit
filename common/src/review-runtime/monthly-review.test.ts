import { describe, expect, it } from 'vitest'
import {
  buildLocalMonthlyReview,
  canShiftTo,
  heatmapCells,
  monthKeyOf,
  monthLabelOf,
  shiftMonth,
  type MonthlyReviewPaper,
} from './index'

function papersWith(papers: Partial<MonthlyReviewPaper>[]): { papers: MonthlyReviewPaper[] } {
  return {
    papers: papers.map((paper) => ({
      deletedAt: paper.deletedAt ?? null,
      createdAt: paper.createdAt ?? '2026-09-05T02:00:00.000Z',
      topicId: paper.topicId ?? null,
      questionStatus: paper.questionStatus ?? 'none',
      questionResolvedAt: paper.questionResolvedAt ?? null,
    })),
  }
}

describe('monthly review helpers', () => {
  it('月份游标前后移动并跨年', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(monthKeyOf({ year: 2026, month: 9 })).toBe('2026-09')
    expect(monthLabelOf({ year: 2026, month: 9 })).toBe('2026 年 9 月')
  })

  it('装订册不允许翻到未来月份', () => {
    expect(canShiftTo({ year: 2026, month: 9 }, new Date(2026, 8, 6))).toBe(true)
    expect(canShiftTo({ year: 2026, month: 10 }, new Date(2026, 8, 6))).toBe(false)
  })

  it('本地聚合纸页数、箱子数与解决数并排除软删', () => {
    const source = papersWith([
      { createdAt: '2026-09-05T02:00:00.000Z', topicId: 'a4c9d2e1-2222-4222-8222-222222222222' },
      { createdAt: '2026-09-08T02:00:00.000Z' },
      {
        createdAt: '2026-09-10T02:00:00.000Z',
        questionStatus: 'resolved',
        questionResolvedAt: '2026-09-12T03:00:00.000Z',
      },
      { createdAt: '2026-08-30T02:00:00.000Z' },
      { createdAt: '2026-09-20T02:00:00.000Z', deletedAt: '2026-09-21T00:00:00.000Z' },
    ])
    const review = buildLocalMonthlyReview(source, { year: 2026, month: 9 })
    expect(review).toMatchObject({ paperCount: 3, topicCount: 1, resolvedCount: 1 })
    expect(review.days).toEqual([
      { date: '2026-09-05', count: 1 },
      { date: '2026-09-08', count: 1 },
      { date: '2026-09-10', count: 1 },
    ])
  })

  it('解决数只统计解决时间落在本月的纸页', () => {
    const source = papersWith([
      {
        createdAt: '2026-08-01T02:00:00.000Z',
        questionStatus: 'resolved',
        questionResolvedAt: '2026-09-02T03:00:00.000Z',
      },
      {
        createdAt: '2026-09-03T02:00:00.000Z',
        questionStatus: 'resolved',
        questionResolvedAt: '2026-10-01T03:00:00.000Z',
      },
    ])
    const review = buildLocalMonthlyReview(source, { year: 2026, month: 9 })
    expect(review.paperCount).toBe(1)
    expect(review.resolvedCount).toBe(0)
  })

  it('热力格子周一开头补空位并按记录数分档', () => {
    // 2026 年 9 月 1 日是周二:开头补 1 个空位
    const cells = heatmapCells(
      [
        { date: '2026-09-01', count: 1 },
        { date: '2026-09-02', count: 3 },
        { date: '2026-09-07', count: 5 },
      ],
      { year: 2026, month: 9 },
    )
    expect(cells[0]).toMatchObject({ dateKey: null, level: 0 })
    expect(cells[1]).toMatchObject({ dateKey: '2026-09-01', level: 1 })
    expect(cells[2]).toMatchObject({ dateKey: '2026-09-02', level: 2 })
    expect(cells.find((cell) => cell.dateKey === '2026-09-07')).toMatchObject({ level: 3 })
    expect(cells).toHaveLength(30 + 1)
  })
})
