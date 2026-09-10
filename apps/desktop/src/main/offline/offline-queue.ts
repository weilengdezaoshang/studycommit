import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * 主进程离线队列(DE-312):片段/纸页创建失败时落盘,网络恢复或下次启动重放。
 * 幂等键由调用方携带,重放不会产生重复数据。
 */

export interface PendingFragmentJob {
  kind: 'fragment'
  sessionId: string
  fragmentId: string
  content: string
  position?: number
  idempotencyKey: string
}

export type PendingJob = PendingFragmentJob

export class OfflineJobQueue {
  constructor(private readonly filePath: string) {}

  private async load(): Promise<PendingJob[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? (parsed as PendingJob[]) : []
    } catch {
      return []
    }
  }

  private async save(jobs: PendingJob[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    if (jobs.length === 0) {
      await rm(this.filePath, { force: true })
      return
    }
    await writeFile(this.filePath, JSON.stringify(jobs, null, 2))
  }

  async enqueue(job: PendingJob): Promise<void> {
    const jobs = await this.load()
    jobs.push(job)
    await this.save(jobs)
  }

  get cachedFilePath(): string {
    return join(this.filePath)
  }

  /** 当前待同步的离线任务数量(C04:收尾前拦截未同步片段)。 */
  async count(): Promise<number> {
    const jobs = await this.load()
    return jobs.length
  }

  /** 依次重放;返回值 indicates 全部成功(成功项出队,失败项保留)。 */
  async drain(retry: (job: PendingJob) => Promise<boolean>): Promise<number> {
    const jobs = await this.load()
    if (jobs.length === 0) {
      return 0
    }
    const remaining: PendingJob[] = []
    let replayed = 0
    for (const job of jobs) {
      let ok = false
      try {
        ok = await retry(job)
      } catch {
        ok = false
      }
      if (ok) {
        replayed += 1
      } else {
        remaining.push(job)
      }
    }
    await this.save(remaining)
    return replayed
  }
}
