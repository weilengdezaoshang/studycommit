import { Body, Controller, Get, Headers, Inject, Param, Post, Res, UseGuards } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { CurrentUserId, TestIdentityGuard } from '../common/current-user'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import { ZodPipe } from '../common/zod.pipe'
import {
  completeStudySessionSchema,
  createStudySessionSchema,
  sessionCommandSchema,
  sessionIdSchema,
  type CompleteStudySessionInput,
  type CreateStudySessionInput,
  type SessionCommandInput,
} from './study-session.schemas'
import { StudySessionsService } from './study-sessions.service'

@Controller('study-sessions')
@UseGuards(TestIdentityGuard)
export class StudySessionsController {
  constructor(@Inject(StudySessionsService) private readonly sessions: StudySessionsService) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(createStudySessionSchema)) body: CreateStudySessionInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.sessions.create(userId, body, requireIdempotencyKey(key))
    if (result.replayed) {
      reply.header(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    }
    return result.session
  }

  @Get('active')
  getActive(@CurrentUserId() userId: string) {
    return this.sessions.getActive(userId)
  }

  @Get(':id')
  get(@CurrentUserId() userId: string, @Param('id', new ZodPipe(sessionIdSchema)) id: string) {
    return this.sessions.get(userId, id)
  }

  @Post(':id/pause')
  async pause(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(sessionIdSchema)) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(sessionCommandSchema)) body: SessionCommandInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.sessions.pause(userId, id, body, requireIdempotencyKey(key))
    if (result.replayed) {
      reply.header(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    }
    return result.session
  }

  @Post(':id/resume')
  async resume(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(sessionIdSchema)) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(sessionCommandSchema)) body: SessionCommandInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.sessions.resume(userId, id, body, requireIdempotencyKey(key))
    if (result.replayed) {
      reply.header(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    }
    return result.session
  }

  @Post(':id/complete')
  async complete(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(sessionIdSchema)) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(completeStudySessionSchema)) body: CompleteStudySessionInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.sessions.complete(userId, id, body, requireIdempotencyKey(key))
    if (result.replayed) {
      reply.header(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    }
    return { session: result.session, learningLog: result.learningLog }
  }
}
