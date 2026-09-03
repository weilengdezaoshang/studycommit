import {
  companionFollowupInputSchema,
  companionFollowupOutputSchema,
  type CompanionFollowupInput,
  type CompanionFollowupOutput,
} from '@studycommit/rpc-contracts/ai'
import type { HttpTransport } from '../../http'
import type { AiApi } from '../../ports'

export type { AiApi } from '../../ports'

/** AI 客户端:对齐后端 AiController 的 REST 路径。 */
export class AiClient implements AiApi {
  constructor(private readonly http: HttpTransport) {}

  companionFollowup(input: CompanionFollowupInput): Promise<CompanionFollowupOutput> {
    return this.http.request({
      method: 'POST',
      path: '/ai/companion/followup',
      body: companionFollowupInputSchema.parse(input),
      responseSchema: companionFollowupOutputSchema,
    })
  }
}
