import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { paperExplainInputSchema, type PaperExplainInput } from '@studycommit/rpc-contracts/ai'
import { CurrentUserId } from '../common/current-user'
import { IdentityGuard } from '../auth/identity.guard'
import { ZodPipe } from '../common/zod.pipe'
import { AiService } from './ai.service'

@Controller('ai')
@UseGuards(IdentityGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  /** 继续弄懂 · 直观解释卡:Agent 不可用时抛 503,客户端按 PRD 降级回纸页。 */
  @Post('papers/explain')
  @HttpCode(200)
  explainPaper(
    @CurrentUserId() userId: string,
    @Body(new ZodPipe(paperExplainInputSchema)) body: PaperExplainInput,
  ) {
    return this.ai.generatePaperExplain(userId, body)
  }

  @Post('runs/:id/confirm')
  @HttpCode(200)
  confirmPaperExplain(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
  ) {
    return this.ai.confirmPaperExplain(userId, id)
  }
}
