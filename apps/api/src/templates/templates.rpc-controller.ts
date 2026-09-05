import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { templateContract } from '@studycommit/rpc-contracts/templates'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { TemplatesService } from './templates.service'

@Controller()
@UseGuards(IdentityGuard)
export class TemplatesRpcController {
  constructor(@Inject(TemplatesService) private readonly templates: TemplatesService) {}

  @Implement(templateContract)
  templatesRouter(@Req() request: AuthedRequest) {
    return {
      list: implement(templateContract.list).handler(() =>
        handleOrpc(() => this.templates.list(request.userId)),
      ),
    }
  }
}
