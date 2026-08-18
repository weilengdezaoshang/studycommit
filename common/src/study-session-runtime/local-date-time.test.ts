import { describe, expect, it } from 'vitest'
import {
  formatLocalDateTimeValue,
  parseLocalDateTimeValue,
  validateLocalDateTimeValue,
} from './local-date-time'

describe('local date time', () => {
  it('parses and formats local values without timezone suffix', () => {
    const parsed = parseLocalDateTimeValue('2026-08-17T08:10')
    expect(parsed).toBeInstanceOf(Date)
    expect(formatLocalDateTimeValue(parsed as Date)).toBe('2026-08-17T08:10')
    expect(parseLocalDateTimeValue('bad')).toBeNull()
  })

  it('rejects empty, invalid, and earlier-than-min values', () => {
    expect(validateLocalDateTimeValue('')).toBe('请填写结束时间')
    expect(validateLocalDateTimeValue('2026-08-17')).toBe(
      '结束时间格式无效，请使用 YYYY-MM-DDTHH:mm',
    )
    expect(validateLocalDateTimeValue('2026-08-17T07:00', '2026-08-17T08:10')).toBe(
      '结束时间不能早于开始时间',
    )
    expect(validateLocalDateTimeValue('2026-08-17T08:10', '2026-08-17T08:10')).toBeNull()
  })
})
