// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserWindow, desktopCapturer, screen } from 'electron'
import { CaptureService } from './capture-service'
import type { CaptureRegistry } from './capture-registry'
import type { CapturePermission } from '../../shared/capture-channels'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  desktopCapturer: { getSources: vi.fn() },
  screen: { getPrimaryDisplay: vi.fn() },
  shell: { openExternal: vi.fn() },
}))

describe('CaptureService permissions', () => {
  const permissions = {
    request: vi.fn<() => Promise<CapturePermission>>(),
    check: vi.fn<() => Promise<CapturePermission>>(),
    openSettings: vi.fn<() => Promise<void>>(),
  }
  beforeEach(() => {
    vi.resetAllMocks()
    permissions.request.mockResolvedValue('denied')
    permissions.check.mockResolvedValue('granted')
    vi.mocked(screen.getPrimaryDisplay).mockReturnValue({
      id: 1,
      size: { width: 800, height: 600 },
      scaleFactor: 1,
    } as Electron.Display)
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([])
  })
  const service = () => new CaptureService({} as CaptureRegistry, '', async () => {}, permissions)

  it('原生授权未通过时不获取屏幕也不打开选区', async () => {
    expect(await service().requestCapture()).toEqual({ status: 'permission-denied' })
    expect(permissions.request).toHaveBeenCalledOnce()
    expect(desktopCapturer.getSources).not.toHaveBeenCalled()
    expect(BrowserWindow).not.toHaveBeenCalled()
  })
  it('已获授权仍需实际获取屏幕并报告取屏失败', async () => {
    permissions.request.mockResolvedValue('granted')
    expect(await service().requestCapture()).toEqual({
      status: 'failed',
      message: '无法获取屏幕画面',
    })
    expect(desktopCapturer.getSources).toHaveBeenCalledOnce()
  })
  it('取屏期间权限被撤销时显示权限提示', async () => {
    permissions.request.mockResolvedValue('granted')
    permissions.check.mockResolvedValue('denied')
    vi.mocked(desktopCapturer.getSources).mockRejectedValueOnce(new Error('denied'))
    expect(await service().requestCapture()).toEqual({ status: 'permission-denied' })
  })
  it('权限组件失败不会伪装成用户拒绝且可再次请求', async () => {
    const capture = service()
    permissions.request.mockRejectedValueOnce(new Error('load failed'))
    expect(await capture.requestCapture()).toMatchObject({ status: 'failed' })
    expect(await capture.requestCapture()).toEqual({ status: 'permission-denied' })
  })
  it('申请权限期间阻止重复截图请求', async () => {
    let complete!: (value: CapturePermission) => void
    permissions.request.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const capture = service()
    const first = capture.requestCapture()
    expect(await capture.requestCapture()).toEqual({
      status: 'failed',
      message: '已有截图正在进行',
    })
    complete('denied')
    await first
    expect(permissions.request).toHaveBeenCalledOnce()
  })
  it('系统设置打开失败时向调用方报告失败', async () => {
    permissions.openSettings.mockRejectedValueOnce(new Error('打开失败'))
    await expect(service().openPermissionSettings()).rejects.toThrow('打开失败')
  })
})
