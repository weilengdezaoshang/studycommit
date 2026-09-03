import {
  confirmPaperExplainInputSchema,
  paperExplainInputSchema,
} from '@studycommit/rpc-contracts/ai'
import type { AiApi } from '@studycommit/common/ports'
import { aiIpcChannels } from '../../shared/ai-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { aiIpcChannels }

export function registerAiIpc(host: IpcHost, ai: AiApi): void {
  host.handle(aiIpcChannels.explainPaper, (input) =>
    ai.explainPaper(parseIpcInput(paperExplainInputSchema, input)),
  )
  host.handle(aiIpcChannels.confirmPaperExplain, (input) =>
    ai.confirmPaperExplain(parseIpcInput(confirmPaperExplainInputSchema, input)),
  )
}
