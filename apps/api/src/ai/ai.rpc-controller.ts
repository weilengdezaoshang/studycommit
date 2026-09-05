import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { aiContract } from '@studycommit/rpc-contracts/ai'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { AiService } from './ai.service'

@Controller()
@UseGuards(IdentityGuard)
export class AiRpcController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Implement(aiContract)
  aiRouter(@Req() request: AuthedRequest) {
    return {
      explainPaper: implement(aiContract.explainPaper).handler(({ input }) =>
        // Agent 不可用时抛 503,客户端按 PRD 降级回纸页。
        handleOrpc(() => this.ai.generatePaperExplain(request.userId, input)),
      ),
      confirmPaperExplain: implement(aiContract.confirmPaperExplain).handler(({ input }) =>
        handleOrpc(() => this.ai.confirmPaperExplain(request.userId, input.runId)),
      ),
    }
  }
}
