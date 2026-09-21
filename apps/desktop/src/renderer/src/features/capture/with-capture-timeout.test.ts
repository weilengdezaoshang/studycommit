import { afterEach, describe, expect, it, vi } from 'vitest'
import { withCaptureTimeout } from './with-capture-timeout'

afterEach(() => vi.useRealTimers())
describe('截图异步等待上限', () => {
  it('识别一直没有返回时在上限处结束等待', async () => {
    vi.useFakeTimers()
    const result = withCaptureTimeout(new Promise(() => {}), 20_000, '识别超时')
    const rejected = expect(result).rejects.toThrow('识别超时')
    await vi.advanceTimersByTimeAsync(20_000)
    await rejected
  })
  it('成功返回后清除计时器', async () => {
    vi.useFakeTimers()
    await expect(withCaptureTimeout(Promise.resolve('完成'), 20_000, '超时')).resolves.toBe('完成')
    expect(vi.getTimerCount()).toBe(0)
  })
})
