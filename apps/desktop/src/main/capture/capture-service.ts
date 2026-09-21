import { BrowserWindow, desktopCapturer, screen, type Display } from 'electron'
import {
  captureIpcChannels,
  isCaptureSelection,
  type CapturePermission,
  type CaptureRequestResult,
  type CaptureSelection,
} from '../../shared/capture-channels'
import type { CaptureRegistry } from './capture-registry'
import { CapturePermissions, type CapturePermissionsPort } from './capture-permissions'

const REQUEST_TIMEOUT_MS = 60_000

export interface CaptureRequestOutcome {
  result: CaptureRequestResult
  /** 确认后的截图登记;取消时为 null */
  captured: { captureId: string; filePath: string; width: number; height: number } | null
}

interface PendingCapture {
  image: Electron.NativeImage
  scaleFactor: number
  resolve: (result: CaptureRequestResult) => void
  timer: NodeJS.Timeout
}

/**
 * 区域截图服务(DE-310):取屏 → 全屏透明覆盖窗选区 → 主进程裁剪 → 临时文件注册表。
 * 覆盖窗加载与主窗口同一渲染层('#/capture-overlay' 路由),由 loadOverlay 注入地址。
 */
export class CaptureService {
  private overlayWindow: BrowserWindow | null = null
  private pending: PendingCapture | null = null
  private requesting = false
  /** 确认页预览:captureId → dataUrl(仅本地内存,不落盘不上传) */
  private readonly previews = new Map<string, string>()

  constructor(
    private readonly registry: CaptureRegistry,
    private readonly preloadPath: string,
    private readonly loadOverlay: (window: BrowserWindow) => Promise<void>,
    private readonly permissions: CapturePermissionsPort = new CapturePermissions(),
  ) {}

  permissionCheck(): Promise<CapturePermission> {
    return this.permissions.check()
  }

  async openPermissionSettings(): Promise<void> {
    await this.permissions.openSettings()
  }

  /** 覆盖窗 webContents id:overlay 通道消息只接受来自覆盖窗的发送方。 */
  get overlayWebContentsId(): number | null {
    return this.overlayWindow?.webContents.id ?? null
  }

  async requestCapture(): Promise<CaptureRequestResult> {
    if (this.requesting || this.pending) {
      return { status: 'failed', message: '已有截图正在进行' }
    }
    this.requesting = true
    try {
      let permission: CapturePermission
      try {
        permission = await this.permissions.request()
      } catch (error) {
        console.error('[capture] 屏幕权限申请失败', error)
        return { status: 'failed', message: '屏幕权限申请失败，请重启应用后重试' }
      }
      if (permission !== 'granted' && permission !== 'not-needed') {
        return { status: 'permission-denied' }
      }
      return await this.captureGrantedDisplay()
    } finally {
      this.requesting = false
    }
  }

  private async captureGrantedDisplay(): Promise<CaptureRequestResult> {
    const display = screen.getPrimaryDisplay()
    let image: Electron.NativeImage | null
    try {
      image = await this.grabDisplay(display)
    } catch {
      const currentPermission = await this.permissionCheck()
      return currentPermission === 'granted' || currentPermission === 'not-needed'
        ? { status: 'failed', message: '无法获取屏幕画面，请重试' }
        : { status: 'permission-denied' }
    }
    const currentPermission = await this.permissionCheck()
    if (currentPermission !== 'granted' && currentPermission !== 'not-needed') {
      return { status: 'permission-denied' }
    }
    if (!image) {
      return { status: 'failed', message: '无法获取屏幕画面' }
    }

    return new Promise<CaptureRequestResult>((resolve) => {
      const timer = setTimeout(() => {
        this.finish({ status: 'failed', message: '截图超时未完成' })
      }, REQUEST_TIMEOUT_MS)
      this.pending = { image, scaleFactor: display.scaleFactor, resolve, timer }
      this.openOverlay(display)
    })
  }

  /** 覆盖窗加载完成:下发取屏帧与坐标信息。只接受来自覆盖窗的调用。 */
  handleOverlayReady(webContentsId: number): void {
    if (!this.pending || webContentsId !== this.overlayWebContentsId) {
      return
    }
    const image = this.pending.image
    const size = image.getSize()
    this.overlayWindow?.webContents.send(captureIpcChannels.overlayState, {
      imageDataUrl: image.toDataURL(),
      // 覆盖窗按逻辑像素布局;帧是物理像素,选区换算交给 dpr
      width: Math.round(size.width / this.pending.scaleFactor),
      height: Math.round(size.height / this.pending.scaleFactor),
      scaleFactor: this.pending.scaleFactor,
    })
  }

  /** 覆盖窗确认选区:按 dpr 裁剪物理像素,写临时注册表并回执主窗口。 */
  async handleOverlaySelection(webContentsId: number, selection: CaptureSelection): Promise<void> {
    if (!this.pending || webContentsId !== this.overlayWebContentsId) {
      return
    }
    if (!isCaptureSelection(selection)) {
      this.finish({ status: 'failed', message: '选区坐标无效' })
      return
    }
    const scaleFactor = this.pending.scaleFactor
    const cropped = this.pending.image.crop({
      x: Math.round(selection.x * scaleFactor),
      y: Math.round(selection.y * scaleFactor),
      width: Math.round(selection.width * scaleFactor),
      height: Math.round(selection.height * scaleFactor),
    })
    const size = cropped.getSize()
    const saved = await this.registry.save(cropped.toPNG(), size.width, size.height)
    this.previews.set(saved.captureId, cropped.toDataURL())
    this.finish({
      status: 'completed',
      captureId: saved.captureId,
      width: size.width,
      height: size.height,
    })
  }

  /** 覆盖窗取消(Esc):立即删除临时截图,不产生上传。 */
  handleOverlayCancel(webContentsId: number): void {
    if (webContentsId !== this.overlayWebContentsId) {
      return
    }
    this.finish({ status: 'cancelled' })
  }

  /** 确认保留:由保存流程在创建纸页成功后调用。 */
  confirm(captureId: string) {
    return this.registry.confirm(captureId)
  }

  /** 确认页截图预览(本地内存中的 dataUrl)。 */
  getPreview(captureId: string): string | null {
    return this.previews.get(captureId) ?? null
  }

  /** 丢弃截图:删除临时文件与预览。 */
  async cancel(captureId: string): Promise<boolean> {
    this.previews.delete(captureId)
    return this.registry.cancel(captureId)
  }

  /** 应用退出:清空全部临时截图。 */
  async dispose(): Promise<void> {
    this.previews.clear()
    await this.registry.disposeAll()
  }

  private async grabDisplay(display: Display): Promise<Electron.NativeImage | null> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * display.scaleFactor),
        height: Math.round(display.size.height * display.scaleFactor),
      },
    })
    if (sources.length === 0) {
      return null
    }
    const matched = sources.find((source) => source.display_id === String(display.id))
    const source = matched ?? sources[0]
    return source.thumbnail.isEmpty() ? null : source.thumbnail
  }

  private openOverlay(display: Display): void {
    const overlay = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.size.width,
      height: display.size.height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    overlay.setMenuBarVisibility(false)
    overlay.once('ready-to-show', () => overlay.show())
    // 用户以系统方式关闭覆盖窗:视为取消
    overlay.once('closed', () => {
      if (this.overlayWindow === overlay) {
        this.overlayWindow = null
      }
      if (this.pending) {
        this.finish({ status: 'cancelled' })
      }
    })
    this.overlayWindow = overlay
    void this.loadOverlay(overlay).catch(() => {
      this.finish({ status: 'failed', message: '覆盖窗加载失败' })
    })
  }

  private finish(result: CaptureRequestResult): void {
    const pending = this.pending
    this.pending = null
    if (pending) {
      clearTimeout(pending.timer)
    }
    const overlay = this.overlayWindow
    this.overlayWindow = null
    if (overlay && !overlay.isDestroyed()) {
      overlay.destroy()
    }
    pending?.resolve(result)
  }
}
