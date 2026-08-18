import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { createHttpError } from '@studycommit/common/http'
import { ipcFailure, ipcSuccess, type IpcResult } from './ipc-result'
import { isTrustedIpcSender, type TrustedIpcSenderOptions } from './validate-ipc-sender'

export class IpcHost {
  private readonly channels = new Set<string>()

  constructor(private readonly trust: TrustedIpcSenderOptions) {}

  handle<T>(channel: string, run: (...args: unknown[]) => Promise<T>): void {
    if (this.channels.has(channel)) {
      ipcMain.removeHandler(channel)
    }
    ipcMain.handle(channel, (event, ...args) => this.invoke(event, () => run(...args)))
    this.channels.add(channel)
  }

  dispose(): void {
    for (const channel of this.channels) {
      ipcMain.removeHandler(channel)
    }
    this.channels.clear()
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

export function parseIpcInput<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw createHttpError({ code: 'INVALID_RESPONSE', message: '请求参数无效' })
  }
  return parsed.data
}
