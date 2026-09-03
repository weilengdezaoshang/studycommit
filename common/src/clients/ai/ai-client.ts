import {
  paperExplainInputSchema,
  paperExplainOutputSchema,
  type PaperExplainInput,
  type PaperExplainOutput,
} from '@studycommit/rpc-contracts/ai'
import type { HttpTransport } from '../../http'
import type { AiApi } from '../../ports'

export type { AiApi } from '../../ports'

/** AI 客户端:对齐后端 AiController 的 REST 路径。 */
export class AiClient implements AiApi {
  constructor(private readonly http: HttpTransport) {}

  explainPaper(input: PaperExplainInput): Promise<PaperExplainOutput> {
    return this.http.request({
      method: 'POST',
      path: '/ai/papers/explain',
      body: paperExplainInputSchema.parse(input),
      responseSchema: paperExplainOutputSchema,
    })
  }
}
