import { describe, expect, it } from 'vitest'
import type { PaperWithExtra } from './view-model'
import { buildVirtualRows, columnsOf, type DayGroup } from './virtual-rows'

/** 构造满足纸页结构的最小夹具:仅日期与数量参与分组计算。 */
function paperOf(dateKey: string, index: number): PaperWithExtra {
  return {
    id: `${dateKey}-p${index}`,
    content: `内容 ${index}`,
    status: 'organized',
    topicId: null,
    version: 1,
    createdAt: `${dateKey}T0${index % 10}:00:00.000Z`,
    updatedAt: `${dateKey}T0${index % 10}:00:00.000Z`,
    deletedAt: null,
    hasQuestion: false,
    isQuestionResolved: false,
    questionStatus: 'none',
    questionText: null,
    understandingText: null,
    questionResolvedAt: null,
    extra: {
      hasQuestion: false,
      isQuestionResolved: false,
      questionStatus: 'none',
      photoPath: null,
    },
  }
}

function dayOf(dateKey: string, count: number): DayGroup {
  return {
    dateKey,
    dayNumber: dateKey.slice(8),
    monthLabel: '9 月',
    weekday: '周四',
    suffix: '今天',
    papers: Array.from({ length: count }, (_, index) => paperOf(dateKey, index)),
  }
}

describe('记录本虚拟行', () => {
  it('卡片按列数分块成行,块随列数变化', () => {
    const groups = [dayOf('2026-09-10', 6)]
    const rows = buildVirtualRows(groups, {}, 3)
    const cardRows = rows.filter((row) => row.kind === 'card-row')
    expect(cardRows).toHaveLength(2)
    expect(cardRows[0].papers).toHaveLength(3)

    // 两列时默认页内行数不变(2 行 × 2 列 = 4 条);展开后 6 条分 3 行
    const rowsTwoColsCollapsed = buildVirtualRows(groups, {}, 2)
    expect(rowsTwoColsCollapsed.filter((row) => row.kind === 'card-row')).toHaveLength(2)
    const rowsTwoColsExpanded = buildVirtualRows(groups, { '2026-09-10': true }, 2)
    const expandedCardRows = rowsTwoColsExpanded.filter((row) => row.kind === 'card-row')
    expect(expandedCardRows).toHaveLength(3)
    expect(expandedCardRows[0].kind === 'card-row' && expandedCardRows[0].papers).toHaveLength(2)
  })

  it('每天默认两页行,超出时给出展开尾行并可收起', () => {
    const groups = [dayOf('2026-09-10', 8)]
    const collapsed = buildVirtualRows(groups, {}, 3)
    expect(collapsed.filter((row) => row.kind === 'card-row')).toHaveLength(2)
    const footer = collapsed.at(-1)
    expect(footer).toMatchObject({ kind: 'day-footer', hiddenCount: 2, expanded: false })

    const expanded = buildVirtualRows(groups, { '2026-09-10': true }, 3)
    expect(expanded.filter((row) => row.kind === 'card-row')).toHaveLength(3)
    const expandedFooter = expanded.at(-1)
    expect(expandedFooter).toMatchObject({ kind: 'day-footer', expanded: true })
  })

  it('不足默认页数的日期没有展开尾行', () => {
    const rows = buildVirtualRows([dayOf('2026-09-10', 4)], {}, 3)
    expect(rows.filter((row) => row.kind === 'day-footer')).toHaveLength(0)
  })

  it('多天分组的行 key 保持稳定且唯一', () => {
    const groups = [dayOf('2026-09-10', 3), dayOf('2026-09-09', 3)]
    const keys = buildVirtualRows(groups, {}, 3).map((row) => row.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys[0]).toBe('2026-09-10:h')
  })

  it('列数:阅读栏打开恒两列,宽视口三列', () => {
    expect(columnsOf(true, true)).toBe(2)
    expect(columnsOf(false, true)).toBe(3)
    expect(columnsOf(false, false)).toBe(2)
  })
})
