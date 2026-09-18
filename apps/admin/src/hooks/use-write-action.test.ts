import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminApiError } from '@/services/api-client'
import { useWriteAction } from './use-write-action'

describe('useWriteAction', () => {
  it('409 不会把 expectedVersion 改成最新，需显式基于最新继续', async () => {
    const { result } = renderHook(() => useWriteAction(3))
    await act(async () => {
      await result.current.run(() =>
        Promise.reject(new AdminApiError('CAMPAIGN_VERSION_CONFLICT', '版本已变化', 409)),
      )
    })
    expect(result.current.conflict?.currentVersion).toBe(3)
    expect(result.current.expectedVersion()).toBe(3)
    expect(result.current.canSubmit).toBe(false)
    act(() => result.current.noteConflictLatest(4))
    expect(result.current.expectedVersion()).toBe(3)
    act(() => result.current.applyLatestVersion(4))
    expect(result.current.expectedVersion()).toBe(4)
    expect(result.current.conflict).toBeNull()
  })

  it('未知结果关闭弹窗后仍然锁定，未变化查询不能解锁', async () => {
    const { result } = renderHook(() => useWriteAction(1))
    await act(async () => {
      await result.current.run(() => Promise.reject(new TypeError('Failed to fetch')))
    })
    expect(result.current.unknown).toBeTruthy()
    act(() => result.current.closeModal())
    expect(result.current.unknown).toBeTruthy()
    expect(result.current.writesLocked).toBe(true)
    await act(async () => {
      const outcome = await result.current.queryUnknown(async () => 'unresolved', '仍待确认')
      expect(outcome).toBe('unresolved')
    })
    expect(result.current.unknown).toContain('仍待确认')
    expect(result.current.writesLocked).toBe(true)
  })

  it('限流期间禁止再次提交', async () => {
    const { result } = renderHook(() => useWriteAction(1))
    const op = vi.fn()
    await act(async () => {
      await result.current.run(() =>
        Promise.reject(new AdminApiError('RATE_LIMITED', '过于频繁', 429, { retryAfterMs: 5000 })),
      )
    })
    expect(result.current.rateLimited).toBe(true)
    await act(async () => {
      await result.current.run(op)
    })
    expect(op).not.toHaveBeenCalled()
  })
})
