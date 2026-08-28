import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import {
  createPaperInputSchema,
  listPapersInputSchema,
  organizePaperInputSchema,
} from '@studycommit/rpc-contracts/papers'
import { z } from 'zod'
import { CurrentUserId, TestIdentityGuard } from '../common/current-user'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import { ZodPipe } from '../common/zod.pipe'
import { PapersService } from './papers.service'

@Controller('papers')
@UseGuards(TestIdentityGuard)
export class PapersController {
  constructor(@Inject(PapersService) private readonly papers: PapersService) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(createPaperInputSchema)) body: { content: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.papers.create(userId, body, requireIdempotencyKey(key))
    if (result.replayed) {
      reply.header(IDEMPOTENCY_REPLAYED_HEADER, 'true')
    }
    return result.paper
  }

  @Get()
  list(
    @CurrentUserId() userId: string,
    @Query(new ZodPipe(listPapersInputSchema))
    query: {
      status?: 'inbox' | 'organized'
      topicId?: string
      limit: number
      cursor?: string
    },
  ) {
    return this.papers.list(userId, query)
  }

  @Get(':id')
  get(@CurrentUserId() userId: string, @Param('id', new ZodPipe(z.uuid())) id: string) {
    return this.papers.get(userId, id)
  }

  @Post(':id/organize')
  @HttpCode(200)
  organize(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Body(new ZodPipe(organizePaperInputSchema.omit({ id: true })))
    body: { topicId: string; version: number },
  ) {
    return this.papers.organize(userId, { id, ...body })
  }
}
