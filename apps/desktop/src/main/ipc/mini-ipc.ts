import type { MiniSessionWindowManager } from '../mini/mini-window'
import { miniIpcChannels } from '../../shared/mini-channels'
import type { IpcHost } from './ipc-host'
import { createHttpError } from '@studycommit/common/http'
import { STUDY_SESSIONS_ENABLED } from '../../shared/feature-flags'

export { miniIpcChannels }

export function registerMiniIpc(host: IpcHost, manager: MiniSessionWindowManager): void {
  host.handle(miniIpcChannels.open, async () => {
    if (!STUDY_SESSIONS_ENABLED) {
      throw createHttpError({ code: 'FORBIDDEN', message: '陪学功能暂未开放' })
    }
    await manager.open()
    return { ok: true as const }
  })
  host.handle(miniIpcChannels.close, async () => {
    manager.close()
    return { ok: true as const }
  })
}
