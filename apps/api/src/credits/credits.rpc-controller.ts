import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { creditsContract } from '@studycommit/rpc-contracts/credits'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { CreditsService } from './credits.service'

@Controller()
@UseGuards(IdentityGuard)
export class CreditsRpcController {
  constructor(@Inject(CreditsService) private readonly credits: CreditsService) {}

  @Implement(creditsContract)
  creditsRouter(@Req() request: AuthedRequest) {
    return {
      balance: implement(creditsContract.balance).handler(() =>
        handleOrpc(async () => {
          const balance = await this.credits.getBalance(request.userId)
          return {
            available: balance.available,
            reserved: balance.reserved,
            expiring: balance.expiring.map((row) => ({
              amount: row.amount,
              expiresAt: row.expiresAt.toISOString(),
            })),
            serverNow: new Date().toISOString(),
          }
        }),
      ),
      ledger: implement(creditsContract.ledger).handler(({ input }) =>
        handleOrpc(async () => {
          const page = await this.credits.listLedger(
            request.userId,
            input.cursor ?? null,
            input.limit,
          )
          return page
        }),
      ),
    }
  }
}
