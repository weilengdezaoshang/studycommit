import { Body, Controller, Get, Inject, Param, Patch, UseGuards } from '@nestjs/common'
import { CurrentUserId, TestIdentityGuard } from '../common/current-user'
import { ZodPipe } from '../common/zod.pipe'
import {
  learningLogIdSchema,
  sessionIdSchema,
  updateLearningLogSchema,
  type UpdateLearningLogInput,
} from './learning-log.schemas'
import { LearningLogsService } from './learning-logs.service'

@Controller()
@UseGuards(TestIdentityGuard)
export class LearningLogsController {
  constructor(@Inject(LearningLogsService) private readonly logs: LearningLogsService) {}

  @Get('study-sessions/:sessionId/learning-log')
  getBySession(
    @CurrentUserId() userId: string,
    @Param('sessionId', new ZodPipe(sessionIdSchema)) sessionId: string,
  ) {
    return this.logs.getBySession(userId, sessionId)
  }

  @Patch('learning-logs/:id')
  update(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(learningLogIdSchema)) id: string,
    @Body(new ZodPipe(updateLearningLogSchema)) body: UpdateLearningLogInput,
  ) {
    return this.logs.update(userId, id, body)
  }
}
