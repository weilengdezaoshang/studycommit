import {
  completePaperInputSchema,
  completeStudySessionInputSchema,
  createSessionFragmentInputSchema,
  createStudySessionInputSchema,
  sessionCommandInputSchema,
  sessionIdSchema,
  updateSessionFragmentInputSchema,
} from '@studycommit/common/contracts'
import type { StudySessionApi } from '@studycommit/common/ports'
import { studySessionIpcChannels } from '../../shared/study-session-channels'
import type { OfflineJobQueue, PendingFragmentJob } from '../offline/offline-queue'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { studySessionIpcChannels }

export interface StudySessionIpcOptions {
  /** 片段离线队列:创建失败落盘,启动/后续成功时重放(DE-312) */
  offlineQueue?: OfflineJobQueue
}

export function registerStudySessionIpc(
  host: IpcHost,
  client: StudySessionApi,
  options: StudySessionIpcOptions = {},
): void {
  const offlineQueue = options.offlineQueue
  const drainQueue = (): void => {
    void offlineQueue
      ?.drain(async (job: PendingFragmentJob) => {
        const { kind: _kind, ...input } = job
        await client.createFragment(input)
        return true
      })
      .catch(() => undefined)
  }
  host.handle(studySessionIpcChannels.create, (input) =>
    client.create(parseIpcInput(createStudySessionInputSchema, input)),
  )
  host.handle(studySessionIpcChannels.getActive, () => client.getActive())
  host.handle(studySessionIpcChannels.getById, (sessionId) =>
    client.getById(parseIpcInput(sessionIdSchema, sessionId)),
  )
  host.handle(studySessionIpcChannels.pause, (input) =>
    client.pause(parseIpcInput(sessionCommandInputSchema, input)),
  )
  host.handle(studySessionIpcChannels.resume, (input) =>
    client.resume(parseIpcInput(sessionCommandInputSchema, input)),
  )
  host.handle(studySessionIpcChannels.complete, (input) =>
    client.complete(parseIpcInput(completeStudySessionInputSchema, input)),
  )
  host.handle(studySessionIpcChannels.completePaper, (input) =>
    client.completePaper(parseIpcInput(completePaperInputSchema, input)),
  )
  host.handle(studySessionIpcChannels.createFragment, async (input) => {
    const parsed = parseIpcInput(createSessionFragmentInputSchema, input)
    try {
      const result = await client.createFragment(parsed)
      // 顺带重放离线期间积压的片段
      drainQueue()
      return result
    } catch (error) {
      // 离线/服务端不可达:片段落盘排队,本地不丢"记下一点"
      await offlineQueue
        ?.enqueue({
          kind: 'fragment',
          sessionId: parsed.sessionId,
          fragmentId: parsed.fragmentId,
          content: parsed.content,
          position: parsed.position,
          idempotencyKey: parsed.idempotencyKey,
        })
        .catch(() => undefined)
      throw error
    }
  })
  host.handle(studySessionIpcChannels.listFragments, (sessionId) =>
    client.listFragments(parseIpcInput(sessionIdSchema, sessionId)),
  )
  host.handle(studySessionIpcChannels.updateFragment, (input) =>
    client.updateFragment(parseIpcInput(updateSessionFragmentInputSchema, input)),
  )
}
