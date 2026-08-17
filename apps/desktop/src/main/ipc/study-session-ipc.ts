import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  completeStudySessionInputSchema,
  createStudySessionInputSchema,
  sessionCommandInputSchema,
  sessionIdSchema,
} from '@studycommit/common/contracts'
import type { StudySessionApi } from '@studycommit/common/study-session'
import { createHttpError } from '@studycommit/common/http'
import { studySessionIpcChannels } from '../../shared/study-session-channels'
import { ipcFailure, ipcSuccess, type IpcResult } from './ipc-result'
import { isTrustedIpcSender, type TrustedIpcSenderOptions } from './validate-ipc-sender'

export { studySessionIpcChannels }

export class StudySessionIpcRegistrar {
  private registered = false

  constructor(
    private readonly client: StudySessionApi,
    private readonly trust: TrustedIpcSenderOptions,
  ) {}

  register(): void {
    if (this.registered) {
      this.dispose()
    }
    ipcMain.handle(studySessionIpcChannels.create, (event, input) =>
      this.invoke(event, () =>
        this.client.create(parseOrThrow(createStudySessionInputSchema, input)),
      ),
    )
    ipcMain.handle(studySessionIpcChannels.getActive, (event) =>
      this.invoke(event, () => this.client.getActive()),
    )
    ipcMain.handle(studySessionIpcChannels.getById, (event, sessionId) =>
      this.invoke(event, () => this.client.getById(parseOrThrow(sessionIdSchema, sessionId))),
    )
    ipcMain.handle(studySessionIpcChannels.pause, (event, input) =>
      this.invoke(event, () => this.client.pause(parseOrThrow(sessionCommandInputSchema, input))),
    )
    ipcMain.handle(studySessionIpcChannels.resume, (event, input) =>
      this.invoke(event, () => this.client.resume(parseOrThrow(sessionCommandInputSchema, input))),
    )
    ipcMain.handle(studySessionIpcChannels.complete, (event, input) =>
      this.invoke(event, () =>
        this.client.complete(parseOrThrow(completeStudySessionInputSchema, input)),
      ),
    )
    this.registered = true
  }

  dispose(): void {
    for (const channel of Object.values(studySessionIpcChannels)) {
      ipcMain.removeHandler(channel)
    }
    this.registered = false
  }

  private async invoke<T>(event: IpcMainInvokeEvent, run: () => Promise<T>): Promise<IpcResult<T>> {
    if (!isTrustedIpcSender(event, this.trust)) {
      return ipcFailure(createHttpError({ code: 'FORBIDDEN', message: '不受信任的窗口' }))
    }
    try {
      const data = await run()
      if (event.sender.isDestroyed() || event.senderFrame?.isDestroyed()) {
        return ipcFailure(createHttpError({ code: 'CANCELLED', message: '窗口已关闭' }))
      }
      return ipcSuccess(data)
    } catch (error) {
      return ipcFailure(error)
    }
  }
}

function parseOrThrow<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw createHttpError({ code: 'INVALID_RESPONSE', message: '请求参数无效' })
  }
  return parsed.data
}
