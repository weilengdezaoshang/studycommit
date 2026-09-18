import { Controller, Headers, Inject, Req, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { Implement, implement } from '@orpc/nest'
import { campaignsContract } from '@studycommit/rpc-contracts/campaigns'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { requireIdempotencyKey } from '../common/idempotency'
import { CampaignsService } from './campaigns.service'
import { campaignErrorOrThrow } from './campaigns.http'

@Controller()
@UseGuards(IdentityGuard, ThrottlerGuard)
export class CampaignsRpcController {
  constructor(@Inject(CampaignsService) private readonly campaigns: CampaignsService) {}

  @Implement(campaignsContract)
  campaignsRouter(
    @Req() request: AuthedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return {
      list: implement(campaignsContract.list).handler(() =>
        handleOrpc(() => this.campaigns.listVisibleForUser(request.userId)),
      ),
      detail: implement(campaignsContract.detail).handler(({ input }) =>
        handleOrpc(async () => {
          const detail = await this.campaigns.getDetailForUser(request.userId, input.id)
          if (!detail) {
            campaignErrorOrThrow('CAMPAIGN_NOT_FOUND')
          }
          return detail
        }),
      ),
      claim: implement(campaignsContract.claim).handler(({ input }) =>
        handleOrpc(async () => {
          const outcome = await this.campaigns.claim({
            userId: request.userId,
            campaignId: input.id,
            expectedVersion: input.expectedVersion,
            idempotencyKey: requireIdempotencyKey(idempotencyKey),
          })
          if (!outcome.ok) {
            campaignErrorOrThrow(outcome.code)
          }
          return {
            claim: {
              claimId: outcome.claimId,
              status: outcome.status,
              grantedCredits: outcome.grantedCredits,
              expiresAt: outcome.expiresAt?.toISOString() ?? null,
              version: outcome.version,
            },
            balance: outcome.balance,
          }
        }),
      ),
    }
  }
}
