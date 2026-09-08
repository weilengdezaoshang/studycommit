import { describe, expect, it } from 'vitest'
import { resolveToastDuration } from './useToast'

describe('toast-react', () => {
  it('按类型解析默认时长:成功 2.5 秒、失败 5 秒、提示 3 秒', () => {
    expect(resolveToastDuration('success')).toBe(2_500)
    expect(resolveToastDuration('error')).toBe(5_000)
    expect(resolveToastDuration('info')).toBe(3_000)
  })

  it('显式传入 durationMs 时优先于类型默认时长', () => {
    expect(resolveToastDuration('error', 1_000)).toBe(1_000)
  })
})
