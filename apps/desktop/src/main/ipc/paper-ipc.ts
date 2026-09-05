import {
  createPaperInputSchema,
  listPapersInputSchema,
  organizePaperInputSchema,
  paperCommandSchema,
  updatePaperInputSchema,
  updatePaperQuestionInputSchema,
} from '@studycommit/common/contracts'
import type { PaperApi } from '@studycommit/common/ports'
import { paperIpcChannels } from '../../shared/paper-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { paperIpcChannels }

export function registerPaperIpc(host: IpcHost, papers: PaperApi): void {
  host.handle(paperIpcChannels.list, (input) =>
    papers.list(parseIpcInput(listPapersInputSchema, input ?? { limit: 20 })),
  )
  host.handle(paperIpcChannels.create, (input) =>
    papers.create(parseIpcInput(createPaperInputSchema, input)),
  )
  host.handle(paperIpcChannels.update, (input) =>
    papers.update(parseIpcInput(updatePaperInputSchema, input)),
  )
  host.handle(paperIpcChannels.organize, (input) =>
    papers.organize(parseIpcInput(organizePaperInputSchema, input)),
  )
  host.handle(paperIpcChannels.moveToInbox, (input) =>
    papers.moveToInbox(parseIpcInput(paperCommandSchema, input)),
  )
  host.handle(paperIpcChannels.remove, (input) =>
    papers.remove(parseIpcInput(paperCommandSchema, input)),
  )
  host.handle(paperIpcChannels.question, (input) =>
    papers.updateQuestion(parseIpcInput(updatePaperQuestionInputSchema, input)),
  )
  host.handle(paperIpcChannels.restore, (input) =>
    papers.restore(parseIpcInput(paperCommandSchema, input)),
  )
}
