import type { PaperExplainInput, PaperExplainOutput } from '@studycommit/rpc-contracts/ai'

export interface AiApi {
  /** 继续弄懂 · 解释卡:Agent 不可用时服务端返回 503,调用方按 PRD 降级回纸页 */
  explainPaper(input: PaperExplainInput): Promise<PaperExplainOutput>
}
