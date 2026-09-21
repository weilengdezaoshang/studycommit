import { app, BrowserWindow, shell } from 'electron'
import { STUDY_SESSIONS_ENABLED } from '../shared/feature-flags'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { CaptureRegistry } from './capture/capture-registry'
import { CaptureService } from './capture/capture-service'
import { OfflineJobQueue } from './offline/offline-queue'
import { MiniSessionWindowManager } from './mini/mini-window'
import { OcrService, resolveOcrModelsDir } from './capture/ocr-service'
import { resolveDesktopServices } from './composition/create-services'
import { loadDesktopEnvFile } from './env/load-desktop-env'
import { registerDesktopIpc } from './ipc/register-desktop-ipc'
import { isAllowedExternalUrl } from './security/navigation-policy'

const preloadPath = join(__dirname, '../preload/index.js')
const rendererPath = join(__dirname, '../renderer/index.html')

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'StudyCommit',
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const currentUrl = window.webContents.getURL()
    try {
      const target = new URL(url)
      const current = new URL(currentUrl)
      const isSameDocument =
        target.origin === current.origin && target.pathname === current.pathname
      if (!isSameDocument) {
        event.preventDefault()
      }
    } catch {
      event.preventDefault()
    }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(rendererPath)
  }
  return window
}

app.whenReady().then(() => {
  const services = resolveDesktopServices(loadDesktopEnvFile())
  let mainWindow: BrowserWindow | null = null

  // 区域截图(DE-310):临时文件放系统 temp/studycommit-captures,退出清空
  const captureRegistry = new CaptureRegistry(join(app.getPath('temp'), 'studycommit-captures'))
  const ocrService = new OcrService(resolveOcrModelsDir(app))
  const miniManager = new MiniSessionWindowManager(app.getPath('userData'), preloadPath, (mini) => {
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      return mini.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/mini-session`)
    }
    return mini.loadFile(rendererPath, { hash: 'mini-session' })
  })
  const offlineQueue = new OfflineJobQueue(join(app.getPath('userData'), 'pending-queue.json'))
  const captureService = new CaptureService(captureRegistry, preloadPath, (overlay) => {
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      return overlay.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/capture-overlay`)
    }
    return overlay.loadFile(rendererPath, { hash: 'capture-overlay' })
  })

  if (is.dev) {
    void captureService.permissionCheck().catch((error) => {
      console.error('[capture] 权限组件自检失败', error)
    })
  }

  const disposeIpc = registerDesktopIpc(services, {
    isDev: is.dev,
    rendererDevOrigin: process.env.ELECTRON_RENDERER_URL,
    offlineQueue,
    miniManager,
    capture: {
      deps: {
        service: captureService,
        registry: captureRegistry,
        ocr: ocrService,
        uploads: services.uploads,
      },
      service: captureService,
      getMainWindow: () => mainWindow,
    },
  })
  mainWindow = createWindow()
  // 重启恢复:仍有从纸页起步的活动会话时,自动打开学习小窗(PRD §6.2,不自动完成)
  setTimeout(() => {
    if (!STUDY_SESSIONS_ENABLED) {
      return
    }
    void services.studySessions
      .getActive()
      .then((active) => {
        if (active.session && active.session.paperId) {
          return miniManager.open()
        }
      })
      .catch(() => undefined)
  }, 2_500)
  app.on('before-quit', () => {
    disposeIpc()
    void captureService.dispose()
    void ocrService.dispose()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      // 重启恢复:仍有从纸页起步的活动会话时,自动打开学习小窗(PRD §6.2,不自动完成)
      setTimeout(() => {
        if (!STUDY_SESSIONS_ENABLED) {
          return
        }
        void services.studySessions
          .getActive()
          .then((active) => {
            if (active.session && active.session.paperId) {
              return miniManager.open()
            }
          })
          .catch(() => undefined)
      }, 2_500)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
