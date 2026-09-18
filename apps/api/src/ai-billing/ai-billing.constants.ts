import type { PaperExplainInput } from '@studycommit/rpc-contracts/ai'

export const AI_BILLING_QUEUE = 'ai-runs'

export const AI_BILLING_ERROR = {
  billingDisabled: {
    code: 'AI_BILLING_DISABLED',
    message: 'AI 生成未开放,请稍后再试',
  },
  billingRequired: {
    code: 'AI_BILLING_REQUIRED',
    message: '该入口已关闭,请通过报价确认后发起生成',
  },
  priceMissing: {
    code: 'AI_PRICE_MISSING',
    message: 'AI 计费尚未配置价格',
  },
  priceChanged: {
    code: 'AI_PRICE_CHANGED',
    message: '价格已变化,请重新确认报价',
  },
  costBudgetExceeded: {
    code: 'AI_COST_BUDGET_EXCEEDED',
    message: '平台成本预算已用尽,请稍后再试',
  },
  runLimit: {
    code: 'AI_RUN_LIMIT',
    message: '正在进行的生成过多,请等待完成后再试',
  },
  idempotencyReused: {
    code: 'IDEMPOTENCY_KEY_REUSED',
    message: '幂等键已用于不同请求',
  },
  runNotFound: {
    code: 'AI_RUN_NOT_FOUND',
    message: '运行记录不存在',
  },
  providerUnavailable: {
    code: 'AI_PROVIDER_UNAVAILABLE',
    message: 'AI 服务商未配置或已停用',
  },
} as const

export type AiBillingErrorCode =
  | (typeof AI_BILLING_ERROR)[keyof typeof AI_BILLING_ERROR]['code']
  /** 冻结失败透传的账务错误码(余额不足等)。 */
  | 'INSUFFICIENT_CREDITS'
  | 'CREDITS_ACCOUNT_MISSING'
  | 'CREDITS_RUN_NOT_FOUND'
  | 'CREDITS_AMOUNT_INVALID'

/** 受理配置:每用户并发上限与对账截止;均为后端权威,客户端不参与判定。 */
export const AI_BILLING_LIMITS = {
  maxActiveRunsPerUser: 2,
} as const

/** 受理后未取得结果的最终截止;超过即释放冻结并终态化。 */
export function resultDeadlineMs(): number {
  return Number(process.env.AI_RUN_RESULT_DEADLINE_MS ?? 180_000)
}

export const OUTBOX_TYPE_RUN_ACCEPTED = 'ai.run_accepted'

export interface StartRunInput {
  action: 'paper_explain'
  input: PaperExplainInput
  expectedPrice: { priceCredits: number; priceVersion: number }
}

export type AcceptRunResult =
  | {
      ok: true
      runId: string
      replayed: boolean
      priceCredits: number
      priceVersion: number
      reservedCredits: number
      deadlineAt: Date
    }
  | { ok: false; code: AiBillingErrorCode }

export type RunPhase = 'queued' | 'running' | 'reconciling' | 'completed' | 'failed' | 'expired'
