import { BrowserWindow, screen } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * 学习小窗(DE-313):320×420 无边框窗,加载 #/mini-session;
 * 位置持久化到 userData;"关闭"为隐藏,会话保持 running(关闭不等于完成)。
 */

const STATE_FILE = 'mini-window-state.json'
const MOVE_SAVE_DELAY_MS = 500

interface MiniWindowState {
  x?: number
  y?: number
}

export class MiniSessionWindowManager {
  private window: BrowserWindow | null = null
  private saveTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly userDataPath: string,
    private readonly preloadPath: string,
    private readonly loadPage: (window: BrowserWindow) => Promise<void>,
  ) {}

  get stateFilePath(): string {
    return join(this.userDataPath, STATE_FILE)
  }

  async open(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show()
      this.window.focus()
      return
    }
    const state = await this.loadState().catch(() => ({}) as MiniWindowState)
    const bounds = screen.getPrimaryDisplay().workArea
    const width = 320
    const height = 420
    const x = state.x ?? bounds.x + bounds.width - width - 24
    const y = state.y ?? bounds.y + 24
    const mini = new BrowserWindow({
      x,
      y,
      width,
      height,
      minWidth: 280,
      minHeight: 320,
      frame: false,
      resizable: true,
      alwaysOnTop: false,
      show: false,
      title: 'StudyCommit 小窗',
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    mini.setMenuBarVisibility(false)
    mini.once('ready-to-show', () => mini.show())
    // 关闭即隐藏:会话保持 running,再次打开立即恢复
    mini.on('close', (event) => {
      if (this.window === mini && !mini.isDestroyed()) {
        event.preventDefault()
        this.savePosition(mini)
        mini.hide()
      }
    })
    mini.on('moved', () => {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer)
      }
      this.saveTimer = setTimeout(() => this.savePosition(mini), MOVE_SAVE_DELAY_MS)
    })
    this.window = mini
    await this.loadPage(mini).catch(() => {
      mini.destroy()
    })
  }

  close(): void {
    const mini = this.window
    this.window = null
    if (mini && !mini.isDestroyed()) {
      this.savePosition(mini)
      mini.destroy()
    }
  }

  private async loadState(): Promise<MiniWindowState> {
    const raw = await readFile(this.stateFilePath, 'utf8')
    const parsed = JSON.parse(raw) as MiniWindowState
    return {
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
    }
  }

  private savePosition(mini: BrowserWindow): void {
    if (mini.isDestroyed()) {
      return
    }
    const [x, y] = mini.getPosition()
    const state: MiniWindowState = { x, y }
    writeFile(this.stateFilePath, JSON.stringify(state)).catch(() => undefined)
  }
}

/** 打开mini时确保目录存在(写状态文件用)。 */
export function ensureStateDir(userDataPath: string): string {
  return dirname(join(userDataPath, STATE_FILE))
}
