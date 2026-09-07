import type { MiniSessionWindowManager } from '../mini/mini-window'
import { miniIpcChannels } from '../../shared/mini-channels'
import type { IpcHost } from './ipc-host'

export { miniIpcChannels }

export function registerMiniIpc(host: IpcHost, manager: MiniSessionWindowManager): void {
  host.handle(miniIpcChannels.open, async () => {
    await manager.open()
    return { ok: true as const }
  })
  host.handle(miniIpcChannels.close, async () => {
    manager.close()
    return { ok: true as const }
  })
}
