// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { CapturePermissions } from './capture-permissions'

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }))

describe('CapturePermissions', () => {
  it('首次返回拒绝状态仍明确发起原生申请且重复点击不重复申请', async () => {
    const native = { getAuthStatus: vi.fn(() => 'denied'), askForScreenCaptureAccess: vi.fn() }
    const permissions = new CapturePermissions('darwin', async () => native)
    expect(await permissions.check()).toBe('denied')
    expect(native.askForScreenCaptureAccess).not.toHaveBeenCalled()
    expect(await permissions.request()).toBe('denied')
    expect(await permissions.request()).toBe('denied')
    expect(native.askForScreenCaptureAccess).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('未决状态会等到授权结果再返回', async () => {
    const getAuthStatus = vi
      .fn()
      .mockReturnValueOnce('not determined')
      .mockReturnValueOnce('not determined')
      .mockReturnValue('authorized')
    const wait = vi.fn().mockResolvedValue(undefined)
    const native = { getAuthStatus, askForScreenCaptureAccess: vi.fn() }
    const permissions = new CapturePermissions(
      'darwin',
      async () => native,
      wait,
      () => 0,
    )
    expect(await permissions.request()).toBe('granted')
    expect(wait).toHaveBeenCalled()
    expect(native.askForScreenCaptureAccess).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('申请后重新检测并返回已授权状态', async () => {
    const getAuthStatus = vi.fn().mockReturnValueOnce('denied').mockReturnValue('authorized')
    const native = { getAuthStatus, askForScreenCaptureAccess: vi.fn() }
    expect(await new CapturePermissions('darwin', async () => native).request()).toBe('granted')
  })

  it('系统设置授权后重新检测可恢复而不重复弹窗', async () => {
    const native = { getAuthStatus: vi.fn(() => 'denied'), askForScreenCaptureAccess: vi.fn() }
    const permissions = new CapturePermissions('darwin', async () => native)
    await permissions.request()
    native.getAuthStatus.mockReturnValue('authorized')
    expect(await permissions.check()).toBe('granted')
    expect(await permissions.request()).toBe('granted')
    expect(native.askForScreenCaptureAccess).toHaveBeenCalledOnce()
  })

  it('系统限制时不尝试申请权限', async () => {
    const native = { getAuthStatus: vi.fn(() => 'restricted'), askForScreenCaptureAccess: vi.fn() }
    expect(await new CapturePermissions('darwin', async () => native).request()).toBe('denied')
    expect(native.askForScreenCaptureAccess).not.toHaveBeenCalled()
  })

  it('非苹果平台不加载原生模块', async () => {
    const load = vi.fn()
    const permissions = new CapturePermissions('win32', load)
    expect(await permissions.check()).toBe('not-needed')
    expect(await permissions.request()).toBe('not-needed')
    expect(load).not.toHaveBeenCalled()
  })

  it('模块加载失败给出明确错误并允许重试', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing native binary'))
      .mockResolvedValue({ getAuthStatus: () => 'authorized', askForScreenCaptureAccess: vi.fn() })
    const permissions = new CapturePermissions('darwin', load)
    await expect(permissions.request()).rejects.toThrow('屏幕权限组件未能加载')
    expect(await permissions.request()).toBe('granted')
  })
})
