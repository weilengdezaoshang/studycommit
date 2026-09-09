/**
 * 月度装订游标(BE-311):年/月二元表示与翻月规则,双端共用。
 * 桌面月度装订页与移动端月份装订册保持同一游标语义。
 */

export interface MonthCursor {
  year: number
  month: number
}

export function monthKeyOf(cursor: MonthCursor): string {
  return `${cursor.year}-${String(cursor.month).padStart(2, '0')}`
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + (cursor.month - 1) + delta
  return { year: Math.floor(total / 12), month: (total % 12) + 1 }
}

export function monthLabelOf(cursor: MonthCursor): string {
  return `${cursor.year} 年 ${cursor.month} 月`
}

/** 装订册不允许翻到未来:以本地今天为界。 */
export function canShiftTo(cursor: MonthCursor, today: Date): boolean {
  return cursor.year * 12 + cursor.month <= today.getFullYear() * 12 + (today.getMonth() + 1)
}
