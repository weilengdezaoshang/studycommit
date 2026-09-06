import {
  buildLocalMonthlyReview,
  canShiftTo,
  heatmapCells,
  monthKeyOf,
  monthLabelOf,
  shiftMonth,
} from './monthly-review'
import type { PapersState } from '../papers/papers-store'

function stateWith(
  papers: Partial<PapersState['papers'][number]>[],
): Pick<PapersState, 'papers' | 'extras'> {
  return {
    papers: papers.map((paper) => ({
      id: paper.id ?? 'a4c9d2e1-1111-4111-8111-111111111111',
      content: paper.content ?? '内容',
      status: paper.status ?? 'inbox',
      topicId: paper.topicId ?? null,
      version: 1,
      createdAt: paper.createdAt ?? '2026-09-05T02:00:00.000Z',
      updatedAt: paper.updatedAt ?? paper.createdAt ?? '2026-09-05T02:00:00.000Z',
      deletedAt: paper.deletedAt ?? null,
      hasQuestion: paper.hasQuestion ?? false,
      isQuestionResolved: paper.isQuestionResolved ?? false,
      questionStatus: paper.questionStatus ?? 'none',
      questionText: paper.questionText ?? null,
      understandingText: paper.understandingText ?? null,
      questionResolvedAt: paper.questionResolvedAt ?? null,
    })),
    extras: {},
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
    const state = stateWith([
      { createdAt: '2026-09-05T02:00:00.000Z', topicId: 'a4c9d2e1-2222-4222-8222-222222222222' },
      { createdAt: '2026-09-08T02:00:00.000Z' },
      {
        createdAt: '2026-09-10T02:00:00.000Z',
        questionStatus: 'resolved',
        hasQuestion: true,
        isQuestionResolved: true,
        questionResolvedAt: '2026-09-12T03:00:00.000Z',
      },
      { createdAt: '2026-08-30T02:00:00.000Z' },
      { createdAt: '2026-09-20T02:00:00.000Z', deletedAt: '2026-09-21T00:00:00.000Z' },
    ])
    const review = buildLocalMonthlyReview(state, { year: 2026, month: 9 })
    expect(review).toMatchObject({ paperCount: 3, topicCount: 1, resolvedCount: 1 })
    expect(review.days).toEqual([
      { date: '2026-09-05', count: 1 },
      { date: '2026-09-08', count: 1 },
      { date: '2026-09-10', count: 1 },
    ])
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
