import {
  completeStudySessionInputSchema,
  createStudySessionInputSchema,
  sessionCommandInputSchema,
  sessionIdSchema,
} from '@studycommit/common/contracts'
import type { StudySessionApi } from '@studycommit/common/study-session'
import { studySessionIpcChannels } from '../../shared/study-session-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { studySessionIpcChannels }

export function registerStudySessionIpc(host: IpcHost, client: StudySessionApi): void {
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
}
