import { shell } from 'electron'
import { createRequire } from 'node:module'
import type { CapturePermission } from '../../shared/capture-channels'

export interface MacScreenPermissions {
  getAuthStatus(type: 'screen'): string
  askForScreenCaptureAccess(openPreferences?: boolean): void
}

export interface CapturePermissionsPort {
  check(): Promise<CapturePermission>
  request(): Promise<CapturePermission>
  openSettings(): Promise<void>
}

/** 仅在 macOS 主进程加载原生模块；读取状态不会触发授权或截图。 */
const UNDETERMINED = new Set(['not determined', 'notDetermined', 'restricted not determined'])

export class CapturePermissions implements CapturePermissionsPort {
  private native: Promise<MacScreenPermissions> | null = null
  private requested = false

  constructor(
    private readonly platform = process.platform,
    private readonly load: () => Promise<MacScreenPermissions> = async () => {
      // 主进程输出为 CommonJS。运行时加载可让 Windows/Linux 无需安装这个 macOS 可选依赖。
      return createRequire(__filename)('node-mac-permissions') as MacScreenPermissions
    },
    private readonly wait: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      }),
    private readonly now: () => number = Date.now,
  ) {}

  private loadNative(): Promise<MacScreenPermissions> {
    this.native ??= this.load().catch((cause: unknown) => {
      this.native = null
      console.error('[capture] 原生权限组件加载失败', cause)
      throw new Error('屏幕权限组件未能加载，请重启应用后重试', { cause })
    })
    return this.native
  }

  private mapStatus(status: string): CapturePermission {
    if (status === 'authorized') {
      return 'granted'
    }
    if (status === 'denied' || status === 'restricted') {
      return 'denied'
    }
    return 'unavailable'
  }

  async check(): Promise<CapturePermission> {
    if (this.platform !== 'darwin') {
      return 'not-needed'
    }
    return this.mapStatus((await this.loadNative()).getAuthStatus('screen'))
  }

  async request(): Promise<CapturePermission> {
    if (this.platform !== 'darwin') {
      return 'not-needed'
    }
    const native = await this.loadNative()
    const status = native.getAuthStatus('screen')
    if (status === 'authorized') {
      return 'granted'
    }
    if (status === 'restricted') {
      return 'denied'
    }
    // macOS 对屏幕权限可能只返回 denied，不能据此判断用户曾拒绝。
    // 首次显式操作仍调用 CGRequestScreenCaptureAccess；重复点击不反复申请。
    if (!this.requested) {
      native.askForScreenCaptureAccess(false)
      this.requested = true
    }
    const deadline = this.now() + 5_000
    let current = native.getAuthStatus('screen')
    while (UNDETERMINED.has(current) && this.now() < deadline) {
      await this.wait(100)
      current = native.getAuthStatus('screen')
    }
    return this.mapStatus(current)
  }

  async openSettings(): Promise<void> {
    if (this.platform === 'darwin') {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
      )
    }
  }
}
