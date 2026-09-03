import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common'
import {
  companionFollowupInputSchema,
  type CompanionFollowupInput,
} from '@studycommit/rpc-contracts/ai'
import { CurrentUserId } from '../common/current-user'
import { IdentityGuard } from '../auth/identity.guard'
import { ZodPipe } from '../common/zod.pipe'
import { AiService } from './ai.service'

@Controller('ai')
@UseGuards(IdentityGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  /** 陪学追问:Agent 不可用时抛 503,客户端按 PRD 直接降级进入奖励揭晓。 */
  @Post('companion/followup')
  @HttpCode(200)
  companionFollowup(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(companionFollowupInputSchema)) body: CompanionFollowupInput,
  ) {
    return this.ai.generateCompanionFollowup(userId, body)
  }
}
