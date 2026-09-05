import {
  listLearningLogsInputSchema,
  sessionIdSchema,
  updateLearningLogInputSchema,
} from '@studycommit/common/contracts'
import type { LearningLogApi } from '@studycommit/common/ports'
import { learningLogIpcChannels } from '../../shared/learning-log-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { learningLogIpcChannels }

export function registerLearningLogIpc(host: IpcHost, client: LearningLogApi): void {
  host.handle(learningLogIpcChannels.list, (input) =>
    client.list(parseIpcInput(listLearningLogsInputSchema, input ?? {})),
  )
  host.handle(learningLogIpcChannels.getBySession, (sessionId) =>
    client.getBySession(parseIpcInput(sessionIdSchema, sessionId)),
  )
  host.handle(learningLogIpcChannels.update, (input) =>
    client.update(parseIpcInput(updateLearningLogInputSchema, input)),
  )
}
