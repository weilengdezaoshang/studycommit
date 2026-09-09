import type { PaperWithExtra } from './view-model'

/** 记录本主页每日期默认展示两行(R58),展开按同步长增加。 */
export const DAY_PAGE_ROWS = 2

/** 行高估算(动态测量前的初始值):标题/按钮行矮,卡片行高。 */
export const HEADER_ROW_ESTIMATE_PX = 64
export const CARD_ROW_ESTIMATE_PX = 250

export interface DayGroup {
  dateKey: string
  dayNumber: string
  monthLabel: string
  weekday: string
  suffix: string
  papers: PaperWithExtra[]
}

/** 虚拟列表行:日期标题、一行卡片、展开/收起均作为一行参与窗口计算。 */
export type VirtualRow =
  | { kind: 'day-heading'; key: string; group: DayGroup }
  | { kind: 'card-row'; key: string; papers: PaperWithExtra[] }
  | { kind: 'day-footer'; key: string; group: DayGroup; hiddenCount: number; expanded: boolean }

/**
 * 把日期分组拍平为虚拟行(R58):卡片按列数分块成行,
 * 每天默认只展示前两行,展开后展示全部;分块随列数变化重新计算。
 */
export function buildVirtualRows(
  groups: DayGroup[],
  expandedDays: Readonly<Record<string, boolean>>,
  cols: number,
): VirtualRow[] {
  const pageSize = Math.max(1, cols * DAY_PAGE_ROWS)
  const rows: VirtualRow[] = []
  for (const group of groups) {
    rows.push({ kind: 'day-heading', key: `${group.dateKey}:h`, group })
    const expanded = expandedDays[group.dateKey] ?? false
    const visible = expanded ? group.papers : group.papers.slice(0, pageSize)
    for (let start = 0; start < visible.length; start += cols) {
      rows.push({
        kind: 'card-row',
        key: `${group.dateKey}:r${start}`,
        papers: visible.slice(start, start + cols),
      })
    }
    if (group.papers.length > visible.length) {
      rows.push({
        kind: 'day-footer',
        key: `${group.dateKey}:f`,
        group,
        hiddenCount: group.papers.length - visible.length,
        expanded,
      })
    } else if (expanded && group.papers.length > pageSize) {
      rows.push({
        kind: 'day-footer',
        key: `${group.dateKey}:f`,
        group,
        hiddenCount: 0,
        expanded: true,
      })
    }
  }
  return rows
}

/** 卡片网格列数:≥1100px 三列(R58),其余两列;阅读栏打开时恒为两列。 */
export function columnsOf(reading: boolean, wideViewport: boolean): number {
  if (reading) {
    return 2
  }
  return wideViewport ? 3 : 2
}

/** 单行高度估算:动态测量前的初始值,测量后以真实高度为准。 */
export function estimateRowSize(row: VirtualRow | undefined): number {
  if (row && row.kind !== 'card-row') {
    return HEADER_ROW_ESTIMATE_PX
  }
  return CARD_ROW_ESTIMATE_PX
}
