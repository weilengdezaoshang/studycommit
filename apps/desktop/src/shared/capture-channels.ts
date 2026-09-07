/** 区域截图(DE-310):主窗口 ↔ 主进程 ↔ 覆盖窗的通道与载荷类型。 */

export const captureIpcChannels = {
  permissionCheck: 'capture:permission-check',
  openPermissionSettings: 'capture:open-permission-settings',
  request: 'capture:request',
  confirm: 'capture:confirm',
  cancel: 'capture:cancel',
  overlayState: 'capture:overlay-state',
  overlayReady: 'capture:overlay-ready',
  overlaySelection: 'capture:overlay-selection',
  overlayCancel: 'capture:overlay-cancel',
  requestResult: 'capture:request-result',
  ocr: 'capture:ocr',
  preview: 'capture:preview',
} as const

export type CapturePermission = 'granted' | 'denied' | 'not-needed' | 'unavailable'

export interface CaptureOcrResult {
  text: string
  confidence: number | null
}

export interface CaptureSelection {
  /** 逻辑像素(与截图帧显示尺寸同坐标系) */
  x: number
  y: number
  width: number
  height: number
}

export type CaptureRequestResult =
  | { status: 'completed'; captureId: string; width: number; height: number }
  | { status: 'cancelled' }
  | { status: 'permission-denied' }
  | { status: 'failed'; message: string }

export interface CaptureConfirmResult {
  captureId: string
  /** PNG 临时文件路径;确认后保留,直到保存成功或丢弃草稿 */
  filePath: string
  width: number
  height: number
}

export interface CaptureOverlayState {
  imageDataUrl: string
  /** 逻辑像素(覆盖窗尺寸) */
  width: number
  height: number
  /** 设备像素比:选区逻辑像素 × dpr = 裁剪物理像素 */
  scaleFactor: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCaptureId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isCaptureSelection(value: unknown): value is CaptureSelection {
  if (!value || typeof value !== 'object') {
    return false
  }
  const { x, y, width, height } = value as Record<string, unknown>
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    (x as number) >= 0 &&
    (y as number) >= 0 &&
    (width as number) >= 1 &&
    (height as number) >= 1
  )
}
