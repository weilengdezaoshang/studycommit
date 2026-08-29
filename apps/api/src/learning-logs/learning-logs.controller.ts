import { Body, Controller, Get, Inject, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { CurrentUserId } from '../common/current-user'
import { IdentityGuard } from '../auth/identity.guard'
import { ZodPipe } from '../common/zod.pipe'
import {
  learningLogIdSchema,
  listLearningLogsQuerySchema,
  sessionIdSchema,
  updateLearningLogSchema,
  type UpdateLearningLogInput,
  type ListLearningLogsQuery,
} from './learning-log.schemas'
import { LearningLogsService } from './learning-logs.service'

@Controller()
@UseGuards(IdentityGuard)
export class LearningLogsController {
  constructor(@Inject(LearningLogsService) private readonly logs: LearningLogsService) {}

  @Get('learning-logs')
  list(
    @CurrentUserId() userId: string,
    @Query(new ZodPipe(listLearningLogsQuerySchema)) query: ListLearningLogsQuery,
  ) {
    return this.logs.list(userId, query)
  }

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
