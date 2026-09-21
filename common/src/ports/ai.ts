import type {
  AiGetRunOutput,
  AiQuoteOutput,
  AiStartRunOutput,
  ConfirmPaperExplainOutput,
  PaperExplainInput,
  PaperExplainOutput,
} from '@studycommit/rpc-contracts/ai'
import type { CampaignsListOutput } from '@studycommit/rpc-contracts/campaigns'
import type { CreditBalance } from '@studycommit/rpc-contracts/credits'
import type { OperationsBootstrapOutput } from '@studycommit/rpc-contracts/operations'

export interface AiApi {
  /** 继续弄懂 · 解释卡:计费受理后查询运行结果;免费路径已移除。 */
  explainRun(
    input: PaperExplainInput,
    expectedPrice: { priceCredits: number; priceVersion: number },
    idempotencyKey: string,
  ): Promise<AiStartRunOutput>
  getRun(runId: string): Promise<AiGetRunOutput>
  /** 报价:显示价格与余额,由用户明确确认后才发起生成。 */
  quote(): Promise<AiQuoteOutput>
  confirmPaperExplain(input: { runId: string }): Promise<ConfirmPaperExplainOutput>
}

export interface CreditsApi {
  balance(): Promise<CreditBalance>
}

export interface CampaignsApi {
  list(): Promise<CampaignsListOutput>
  claim(
    input: { id: string; expectedVersion: number },
    idempotencyKey: string,
  ): Promise<{
    claim: {
      claimId: string
      status: 'granted' | 'pending_compensation'
      grantedCredits: number | null
      expiresAt: string | null
      version: number
    }
    balance: { available: number; reserved: number }
  }>
}

export interface OperationsApi {
  bootstrap(): Promise<OperationsBootstrapOutput>
}

export type { AiGetRunOutput, AiQuoteOutput, AiStartRunOutput, PaperExplainOutput }
