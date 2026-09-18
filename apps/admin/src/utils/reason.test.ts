import { describe, expect, it } from 'vitest'
import { REASON_MAX, validateReason } from './reason'
import { CODE_PATTERN, optionalLimit, validateDraftForm } from '../pages/Campaigns/draft-form'
import dayjs from 'dayjs'

describe('理由校验', () => {
  it('trim 后要求 1 到 500 字', () => {
    expect(validateReason('   ')).toBeTruthy()
    expect(validateReason('发布秋季活动')).toBeNull()
    expect(validateReason('a'.repeat(REASON_MAX + 1))).toBeTruthy()
  })
})

describe('活动草稿表单', () => {
  it('code 仅允许小写字母数字连字符，预算空值为不限、0 为无额度', () => {
    expect(CODE_PATTERN.test('autumn-2026')).toBe(true)
    expect(CODE_PATTERN.test('Autumn 2026')).toBe(false)
    expect(optionalLimit(undefined)).toBeNull()
    expect(optionalLimit(null)).toBeNull()
    expect(optionalLimit(0)).toBe(0)
  })

  it('结束时间早于开始时间时校验失败', () => {
    const errors = validateDraftForm(
      {
        code: 'autumn-2026',
        type: 'limited_claim',
        startsAt: dayjs('2026-09-18T00:00:00+08:00'),
        endsAt: dayjs('2026-09-17T00:00:00+08:00'),
        grantCredits: 100,
        validityMode: 'days',
        creditValidityDays: 30,
        perUserLimit: 1,
        title: '秋日',
        description: '描述',
        successMessage: '成功',
        platforms: ['desktop'],
        reason: '新学期运营活动',
      },
      'create',
    )
    expect(errors.endsAt).toBeTruthy()
  })
})
