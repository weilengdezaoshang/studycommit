import { captureIpcChannels, isCaptureId, isCaptureSelection } from '../../shared/capture-channels'
import type { CaptureConfirmResult } from '../../shared/capture-channels'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createHttpError } from '@studycommit/common/http'
import type { UploadsApi } from '@studycommit/common/ports'
import type { IpcHost } from '../ipc/ipc-host'
import type { CaptureRegistry } from './capture-registry'
import type { CaptureService } from './capture-service'
import type { OcrService } from './ocr-service'

export interface CaptureIpcDeps {
  service: CaptureService
  registry: CaptureRegistry
  ocr: OcrService
  uploads: UploadsApi
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
    deps.ocr.forget(captureId)
    return deps.service.cancel(captureId)
  })

  // 本地 OCR(DE-311):同一 captureId 结果缓存,原始截图不出本机
  host.handle(captureIpcChannels.ocr, async (input) => {
    const captureId = (input as { captureId?: unknown } | undefined)?.captureId
    if (!isCaptureId(captureId)) {
      return { text: '', confidence: null }
    }
    const entry = deps.registry.get(captureId)
    if (!entry) {
      return { text: '', confidence: null }
    }
    return deps.ocr.recognize(captureId, entry.filePath)
  })

  // 确认页截图预览:仅本地内存 dataUrl
  host.handle(captureIpcChannels.preview, async (input) => {
    const captureId = (input as { captureId?: unknown } | undefined)?.captureId
    if (!isCaptureId(captureId)) {
      return null
    }
    return deps.service.getPreview(captureId)
  })

  // 截图直传(BE-308):主进程持令牌读临时 PNG,走三步直传,返回 uploadId 供 draftPaper 绑定
  host.handle(captureIpcChannels.upload, async (input) => {
    const captureId = (input as { captureId?: unknown } | undefined)?.captureId
    if (!isCaptureId(captureId)) {
      throw createHttpError({ code: 'INVALID_RESPONSE', message: 'captureId 无效' })
    }
    const entry = deps.registry.get(captureId)
    if (!entry) {
      throw createHttpError({ code: 'NOT_FOUND', message: '截图不存在或已丢弃' })
    }
    const bytes = await readFile(entry.filePath)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const uploadId = randomUUID()
    const created = await deps.uploads.create({
      uploadId,
      kind: 'source_screenshot',
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      sha256,
    })
    const response = await fetch(created.uploadUrl, {
      method: 'PUT',
      headers: created.headers,
      body: bytes,
    })
    if (!response.ok) {
      throw createHttpError({
        code: 'SERVER_ERROR',
        message: `截图直传失败(HTTP ${response.status})`,
      })
    }
    await deps.uploads.complete(uploadId)
    return { uploadId }
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
