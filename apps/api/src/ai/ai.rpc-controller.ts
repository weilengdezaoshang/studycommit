import {
  ConflictException,
  Controller,
  GoneException,
  Headers,
  Inject,
  NotFoundException,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { Implement, implement } from '@orpc/nest'
import { aiContract } from '@studycommit/rpc-contracts/ai'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { requireIdempotencyKey } from '../common/idempotency'
import { AiBillingService } from '../ai-billing/ai-billing.service'
import { AI_BILLING_ERROR } from '../ai-billing/ai-billing.constants'
import { CREDITS_ERROR } from '../credits/credits.constants'
import { AiService } from './ai.service'

const BILLING_CONFLICT_CODES = new Set([
  'AI_PRICE_CHANGED',
  'IDEMPOTENCY_KEY_REUSED',
  'AI_RUN_LIMIT',
  'AI_COST_BUDGET_EXCEEDED',
  CREDITS_ERROR.insufficient.code,
  CREDITS_ERROR.accountMissing.code,
  CREDITS_ERROR.amountInvalid.code,
])

/** 计费相关错误码到 HTTP 语义的映射。 */
function billingException(code: string): never {
  const payload =
    Object.values(AI_BILLING_ERROR).find((entry) => entry.code === code) ??
    Object.values(CREDITS_ERROR).find((entry) => entry.code === code)
  const body = payload ?? { code, message: code }
  if (BILLING_CONFLICT_CODES.has(code)) {
    throw new ConflictException(body)
  }
  throw new ServiceUnavailableException(body)
}

@Controller()
@UseGuards(IdentityGuard, ThrottlerGuard)
export class AiRpcController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(AiBillingService) private readonly billing: AiBillingService,
  ) {}

  @Implement(aiContract)
  aiRouter(
    @Req() request: AuthedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return {
      // 旧免费生成入口:计费上线后显式拒绝(410),不保留同步直调路径。
      streamPaper: implement(aiContract.streamPaper).handler(() =>
        handleOrpc(async () => {
          throw new GoneException(AI_BILLING_ERROR.billingRequired)
        }),
      ),
      explainPaper: implement(aiContract.explainPaper).handler(() =>
        handleOrpc(async () => {
          throw new GoneException(AI_BILLING_ERROR.billingRequired)
        }),
      ),
      confirmPaperExplain: implement(aiContract.confirmPaperExplain).handler(({ input }) =>
        handleOrpc(() => this.ai.confirmPaperExplain(request.userId, input.runId)),
      ),
      quote: implement(aiContract.quote).handler(({ input }) =>
        handleOrpc(async () => {
          const price = await this.billing.quote(input.action)
          if (!price) {
            throw new ServiceUnavailableException(AI_BILLING_ERROR.priceMissing)
          }
          const balance = await this.billing.getBalance(request.userId)
          return {
            action: input.action,
            priceCredits: price.priceCredits,
            priceVersion: price.version,
            balance,
          }
        }),
      ),
      startRun: implement(aiContract.startRun).handler(({ input }) =>
        handleOrpc(async () => {
          const outcome = await this.billing.startRun(
            request.userId,
            { action: input.action, input: input.input, expectedPrice: input.expectedPrice },
            requireIdempotencyKey(idempotencyKey),
          )
          if (!outcome.ok) {
            billingException(outcome.code)
          }
          return {
            runId: outcome.runId,
            runPhase: 'queued' as const,
            priceCredits: outcome.priceCredits,
            priceVersion: outcome.priceVersion,
            reservedCredits: outcome.reservedCredits,
            deadlineAt: outcome.deadlineAt.toISOString(),
          }
        }),
      ),
      getRun: implement(aiContract.getRun).handler(({ input }) =>
        handleOrpc(async () => {
          const run = await this.billing.getRun(request.userId, input.runId)
          if (!run) {
            throw new NotFoundException(AI_BILLING_ERROR.runNotFound)
          }
          return run
        }),
      ),
    }
  }
}
