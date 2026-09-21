import {
  confirmPaperExplainInputSchema,
  paperExplainInputSchema,
} from '@studycommit/rpc-contracts/ai'
import type { AiApi } from '@studycommit/common/ports'
import { aiIpcChannels } from '../../shared/ai-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

const zRunId = {
  safeParse: (value: unknown) => {
    const runId = (value as { runId?: unknown } | null)?.runId
    return typeof runId === 'string' && runId.length > 0
      ? { success: true as const, data: { runId } }
      : ({ success: false as const } as const)
  },
}

export { aiIpcChannels }

export function registerAiIpc(host: IpcHost, ai: AiApi): () => void {
  host.handle(aiIpcChannels.quote, () => ai.quote())
  host.handle(aiIpcChannels.startRun, (raw) => {
    const payload = raw as {
      input: unknown
      expectedPrice: { priceCredits: number; priceVersion: number }
      idempotencyKey: string
    }
    if (!payload?.idempotencyKey || typeof payload.idempotencyKey !== 'string') {
      throw new Error('幂等键缺失')
    }
    return ai.explainRun(
      parseIpcInput(paperExplainInputSchema, payload.input),
      payload.expectedPrice,
      payload.idempotencyKey,
    )
  })
  host.handle(aiIpcChannels.getRun, (raw) => {
    const parsed = parseIpcInput(zRunId, raw) as { runId: string }
    return ai.getRun(parsed.runId)
  })
  host.handle(aiIpcChannels.confirmPaperExplain, (input) =>
    ai.confirmPaperExplain(parseIpcInput(confirmPaperExplainInputSchema, input)),
  )
  return () => undefined
}
