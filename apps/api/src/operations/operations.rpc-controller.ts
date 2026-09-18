import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { operationsContract } from '@studycommit/rpc-contracts/operations'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { OperationsService } from './operations.service'

@Controller()
@UseGuards(IdentityGuard)
export class OperationsRpcController {
  constructor(@Inject(OperationsService) private readonly operations: OperationsService) {}

  @Implement(operationsContract)
  operationsRouter(@Req() request: AuthedRequest) {
    return {
      bootstrap: implement(operationsContract.bootstrap).handler(() =>
        handleOrpc(() => this.operations.bootstrap(request.userId)),
      ),
    }
  }
}
