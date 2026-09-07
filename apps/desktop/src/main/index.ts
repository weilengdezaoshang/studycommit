import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { CaptureRegistry } from './capture/capture-registry'
import { CaptureService } from './capture/capture-service'
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
  const captureService = new CaptureService(captureRegistry, preloadPath, (overlay) => {
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      return overlay.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/capture-overlay`)
    }
    return overlay.loadFile(rendererPath, { hash: 'capture-overlay' })
  })

  const disposeIpc = registerDesktopIpc(services, {
    isDev: is.dev,
    rendererDevOrigin: process.env.ELECTRON_RENDERER_URL,
    capture: {
      deps: { service: captureService },
      service: captureService,
      getMainWindow: () => mainWindow,
    },
  })
  mainWindow = createWindow()
  app.on('before-quit', () => {
    disposeIpc()
    void captureService.dispose()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
