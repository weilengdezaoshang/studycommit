// 在真正的 Electron 主进程验证原生模块，只读取状态，不申请权限或截屏。
import { app } from 'electron'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))

app.whenReady().then(() => {
  try {
    if (process.platform !== 'darwin') {
      console.log('此平台无需 macOS 屏幕权限模块')
    } else {
      const permissions = createRequire(resolve(scriptDir, '../out/main/index.js'))(
        'node-mac-permissions',
      )
      console.log(
        JSON.stringify({
          electron: process.versions.electron,
          architecture: process.arch,
          screenPermission: permissions.getAuthStatus('screen'),
          requestAvailable: typeof permissions.askForScreenCaptureAccess === 'function',
        }),
      )
    }
    app.exit(0)
  } catch (error) {
    console.error(
      '原生屏幕权限组件检查失败:',
      error instanceof Error ? error.message : String(error),
    )
    app.exit(1)
  }
})
