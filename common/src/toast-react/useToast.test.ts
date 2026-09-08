import { describe, expect, it } from 'vitest'
import { normalizeToastType, resolveToastDuration } from './useToast'

describe('toast-react', () => {
  it('归一化 toast 类型时把旧的 default 当作 info', () => {
    expect(normalizeToastType('default')).toBe('info')
    expect(normalizeToastType(undefined)).toBe('info')
    expect(normalizeToastType('success')).toBe('success')
    expect(normalizeToastType('error')).toBe('error')
  })

  it('按类型解析默认时长:成功 2.5 秒、失败 5 秒、提示 3 秒', () => {
    expect(resolveToastDuration('success')).toBe(2_500)
    expect(resolveToastDuration('error')).toBe(5_000)
    expect(resolveToastDuration('info')).toBe(3_000)
  })

  it('显式传入 durationMs 时优先于类型默认时长', () => {
    expect(resolveToastDuration('error', 1_000)).toBe(1_000)
  })
})
