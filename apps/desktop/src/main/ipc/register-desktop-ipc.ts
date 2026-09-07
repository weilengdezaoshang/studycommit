import { globalShortcut } from 'electron'
import type { BrowserWindow } from 'electron'
import type { DesktopServices } from '../composition/create-services'
import { captureIpcChannels } from '../../shared/capture-channels'
import type { CaptureIpcDeps } from '../capture/capture-ipc'
import { registerCaptureIpc } from '../capture/capture-ipc'
import type { CaptureService } from '../capture/capture-service'
import { IpcHost } from './ipc-host'
import { registerAiIpc } from './ai-ipc'
import { registerAuthIpc } from './auth-ipc'
import { registerLearningLogIpc } from './learning-log-ipc'
import { registerPaperIpc } from './paper-ipc'
import { registerStudySessionIpc } from './study-session-ipc'
import { registerTopicIpc } from './topic-ipc'
import type { TrustedIpcSenderOptions } from './validate-ipc-sender'

/** 默认截图快捷键;登录成功后注册,退出时统一注销。 */
export const CAPTURE_SHORTCUT = 'CmdOrCtrl+Shift+A'

export interface DesktopIpcOptions extends TrustedIpcSenderOptions {
  capture?: {
    deps: CaptureIpcDeps
    service: CaptureService
    getMainWindow: () => BrowserWindow | null
    /** 登录成功后注册全局快捷键;由 auth-ipc 触发 */
    registerShortcutOnLogin?: boolean
  }
}

export function registerDesktopIpc(
  services: DesktopServices,
  options: DesktopIpcOptions,
): () => void {
  const host = new IpcHost(options)
  registerStudySessionIpc(host, services.studySessions)
  registerTopicIpc(host, services.topics)
  registerLearningLogIpc(host, services.learningLogs)
  registerPaperIpc(host, services.papers)
  registerAuthIpc(host, services.auth, options.capture ? registerCaptureShortcut : undefined)
  registerAiIpc(host, services.ai)
  if (options.capture) {
    registerCaptureIpc(host, options.capture.deps)
  }
  return () => {
    host.dispose()
    globalShortcut.unregister(CAPTURE_SHORTCUT)
  }

  function registerCaptureShortcut(): void {
    if (!options.capture) {
      return
    }
    const { service, getMainWindow } = options.capture
    globalShortcut.unregister(CAPTURE_SHORTCUT)
    globalShortcut.register(CAPTURE_SHORTCUT, () => {
      void service.requestCapture().then((result) => {
        const window = getMainWindow()
        if (window && !window.isDestroyed()) {
          window.webContents.send(captureIpcChannels.requestResult, result)
        }
      })
    })
  }
}
