import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCaptureEntry } from './use-capture-entry'

describe('useCaptureEntry', () => {
  it('从系统设置返回后重新检查权限但不自动截屏', async () => {
    const request = vi
      .spyOn(window.studyCommit.capture, 'request')
      .mockResolvedValue({ ok: true, data: { status: 'permission-denied' } })
    vi.spyOn(window.studyCommit.capture, 'permissionCheck').mockResolvedValue({
      ok: true,
      data: 'granted',
    })
    const { result } = renderHook(() => useCaptureEntry())
    await act(() => result.current.start())
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current.permissionDenied).toBe(false)
    expect(result.current.notice).toBe('屏幕录制权限已允许，请再次点击截图学习')
    expect(request).toHaveBeenCalledOnce()
  })

  it('直接发起截图以允许首次申请权限且重试后清除旧权限提示', async () => {
    const request = vi
      .spyOn(window.studyCommit.capture, 'request')
      .mockResolvedValueOnce({ ok: true, data: { status: 'permission-denied' } })
      .mockResolvedValueOnce({ ok: true, data: { status: 'cancelled' } })
    const permission = vi.spyOn(window.studyCommit.capture, 'permissionCheck')
    const { result } = renderHook(() => useCaptureEntry())
    await act(() => result.current.start())
    expect(result.current.permissionDenied).toBe(true)
    expect(permission).not.toHaveBeenCalled()
    await act(() => result.current.start())
    expect(result.current.permissionDenied).toBe(false)
    expect(request).toHaveBeenCalledTimes(2)
  })
})
