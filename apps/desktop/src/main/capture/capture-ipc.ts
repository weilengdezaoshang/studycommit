import { captureIpcChannels, isCaptureId, isCaptureSelection } from '../../shared/capture-channels'
import type { CaptureConfirmResult } from '../../shared/capture-channels'
import type { IpcHost } from '../ipc/ipc-host'
import type { CaptureService } from './capture-service'

export interface CaptureIpcDeps {
  service: CaptureService
}

/** 拒绝非覆盖窗发来的消息;返回 null 表示忽略。 */
function overlayGuarded<T>(deps: CaptureIpcDeps, senderId: number, run: () => T): T | null {
  if (senderId !== deps.service.overlayWebContentsId) {
    return null
  }
  return run()
}

export function registerCaptureIpc(host: IpcHost, deps: CaptureIpcDeps): void {
  host.handle(captureIpcChannels.permissionCheck, async () => deps.service.permissionCheck())
  host.handle(captureIpcChannels.openPermissionSettings, async () => {
    deps.service.openPermissionSettings()
    return { ok: true as const }
  })
  // 该 invoke 会挂起直到覆盖窗流程结束(完成/取消/超时),由 CaptureService 内部超时兜底
  host.handle(captureIpcChannels.request, async () => deps.service.requestCapture())
  host.handle(captureIpcChannels.confirm, async (input) => {
    const captureId = (input as { captureId?: unknown } | undefined)?.captureId
    if (!isCaptureId(captureId)) {
      return null
    }
    const confirmed = deps.service.confirm(captureId)
    const result: CaptureConfirmResult | null = confirmed
      ? {
          captureId: confirmed.captureId,
          filePath: confirmed.filePath,
          width: confirmed.width,
          height: confirmed.height,
        }
      : null
    return result
  })
  host.handle(captureIpcChannels.cancel, async (input) => {
    const captureId = (input as { captureId?: unknown } | undefined)?.captureId
    if (!isCaptureId(captureId)) {
      return false
    }
    return deps.service.cancel(captureId)
  })

  // 覆盖窗通道:sender 必须是覆盖窗本身,载荷手工守卫(桌面 shared 层不引入 zod)
  host.handleWithEvent(captureIpcChannels.overlayReady, async (event) => {
    overlayGuarded(deps, event.sender.id, () => deps.service.handleOverlayReady(event.sender.id))
    return { ok: true as const }
  })
  host.handleWithEvent(captureIpcChannels.overlaySelection, async (event, input) => {
    const payload = (input ?? {}) as { selection?: unknown }
    overlayGuarded(deps, event.sender.id, () => {
      if (!isCaptureSelection(payload.selection)) {
        return
      }
      void deps.service.handleOverlaySelection(event.sender.id, payload.selection)
    })
    return { ok: true as const }
  })
  host.handleWithEvent(captureIpcChannels.overlayCancel, async (event) => {
    overlayGuarded(deps, event.sender.id, () => deps.service.handleOverlayCancel(event.sender.id))
    return { ok: true as const }
  })
}
