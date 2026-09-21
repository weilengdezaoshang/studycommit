import { paperKnowledgeCommandSchema, paperIdSchema } from '@studycommit/rpc-contracts/papers'
import {
  createPaperInputSchema,
  listPapersInputSchema,
  organizePaperInputSchema,
  paperCommandSchema,
  updatePaperInputSchema,
  updatePaperQuestionInputSchema,
} from '@studycommit/common/contracts'
import type { PaperApi, UploadsApi } from '@studycommit/common/ports'
import { paperIpcChannels } from '../../shared/paper-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { paperIpcChannels }

function parseCreatePaperIpc(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { body: parseIpcInput(createPaperInputSchema, input) }
  }
  const { idempotencyKey, ...body } = input as Record<string, unknown>
  return {
    body: parseIpcInput(createPaperInputSchema, body),
    idempotencyKey:
      idempotencyKey === undefined
        ? undefined
        : parseIpcInput(paperIdSchema, { id: idempotencyKey }).id,
  }
}

export function registerPaperIpc(host: IpcHost, papers: PaperApi, uploads?: UploadsApi): void {
  host.handle(paperIpcChannels.get, (input) => {
    if (!papers.get) {
      throw new Error('详情服务不可用')
    }
    return papers.get(parseIpcInput(paperIdSchema, { id: input }).id)
  })
  host.handle(paperIpcChannels.knowledge, (input) => {
    if (!papers.knowledge) {
      throw new Error('详情服务不可用')
    }
    return papers.knowledge(parseIpcInput(paperIdSchema, { id: input }).id)
  })
  host.handle(paperIpcChannels.updateKnowledge, (input) => {
    if (!papers.updateKnowledge) {
      throw new Error('详情服务不可用')
    }
    return papers.updateKnowledge(parseIpcInput(paperKnowledgeCommandSchema, input))
  })
  host.handle(paperIpcChannels.list, (input) =>
    papers.list(parseIpcInput(listPapersInputSchema, input ?? { limit: 20 })),
  )
  host.handle(paperIpcChannels.create, (input) => {
    const parsed = parseCreatePaperIpc(input)
    return papers.create(
      parsed.body,
      parsed.idempotencyKey ? { idempotencyKey: parsed.idempotencyKey } : undefined,
    )
  })
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
  host.handle(paperIpcChannels.assetAccess, (input) => {
    if (!uploads) {
      throw new Error('附件服务不可用')
    }
    return uploads.access(parseIpcInput(paperIdSchema, { id: input }).id)
  })
}
