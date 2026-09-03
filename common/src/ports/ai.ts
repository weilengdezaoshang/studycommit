import type { CompanionFollowupInput, CompanionFollowupOutput } from '@studycommit/rpc-contracts/ai'

export interface AiApi {
  /** 陪学追问:Agent 不可用时服务端返回 503,调用方按 PRD 降级 */
  companionFollowup(input: CompanionFollowupInput): Promise<CompanionFollowupOutput>
}
