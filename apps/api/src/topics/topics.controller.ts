import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { CurrentUserId, TestIdentityGuard } from '../common/current-user'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import { ZodPipe } from '../common/zod.pipe'
import {
  createTopicSchema,
  idSchema,
  listTopicsSchema,
  updateTopicSchema,
  type CreateTopicInput,
  type ListTopicsInput,
  type UpdateTopicInput,
} from './topic.schemas'
import { TopicsService } from './topics.service'

@Controller('topics')
@UseGuards(TestIdentityGuard)
export class TopicsController {
  constructor(@Inject(TopicsService) private readonly topics: TopicsService) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(createTopicSchema)) body: CreateTopicInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.topics.create(userId, body, requireIdempotencyKey(key))
    if (result.replayed) {
      reply.header(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    }
    return result.topic
  }

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query(new ZodPipe(listTopicsSchema)) query: ListTopicsInput,
  ) {
    return this.topics.list(userId, query)
  }

  @Get(':id')
  get(@CurrentUserId() userId: string, @Param('id', new ZodPipe(idSchema)) id: string) {
    return this.topics.get(userId, id)
  }

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(idSchema)) id: string,
    @Body(new ZodPipe(updateTopicSchema)) body: UpdateTopicInput,
  ) {
    return this.topics.update(userId, id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(idSchema)) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    const match = /^"?(\d+)"?$/.exec(ifMatch ?? '')
    if (!match) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'If-Match 必须包含资源版本',
      })
    }
    await this.topics.remove(userId, id, Number(match[1]))
  }
}
