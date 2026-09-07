import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 截图临时文件注册表(DE-310):
 * 取消 → 立即删除文件;确认 → 保留到保存成功或丢弃;应用退出 → 清空全部。
 * 与 Electron 类型解耦(只消费 PNG 字节),便于在 node 测试环境验证生命周期。
 */

export interface CapturedScreenshot {
  captureId: string
  filePath: string
  width: number
  height: number
}

interface RegistryEntry {
  filePath: string
  width: number
  height: number
}

export class CaptureRegistry {
  private readonly entries = new Map<string, RegistryEntry>()

  constructor(private readonly rootDir: string) {}

  /** 保存截图 PNG 并登记;返回给覆盖窗流程的唯一 captureId。 */
  async save(png: Buffer, width: number, height: number): Promise<CapturedScreenshot> {
    await mkdir(this.rootDir, { recursive: true })
    const captureId = randomUUID()
    const filePath = join(this.rootDir, `${captureId}.png`)
    await writeFile(filePath, png)
    this.entries.set(captureId, { filePath, width, height })
    return { captureId, filePath, width, height }
  }

  /** 用户确认:文件保留,交给保存流程消费。 */
  confirm(captureId: string): CapturedScreenshot | null {
    const entry = this.entries.get(captureId)
    if (!entry) {
      return null
    }
    return { captureId, ...entry }
  }

  /** 用户取消:立即删除临时文件,不留云端数据。 */
  async cancel(captureId: string): Promise<boolean> {
    const entry = this.entries.get(captureId)
    if (!entry) {
      return false
    }
    this.entries.delete(captureId)
    await rm(entry.filePath, { force: true })
    return true
  }

  /** 应用退出:清空注册表全部临时文件。 */
  async disposeAll(): Promise<void> {
    const ids = [...this.entries.keys()]
    for (const id of ids) {
      await this.cancel(id)
    }
  }

  /** 测试辅助:当前登记数量。 */
  get size(): number {
    return this.entries.size
  }
}
