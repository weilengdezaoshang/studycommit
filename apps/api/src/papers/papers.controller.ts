import {
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
import {
  createPaperInputSchema,
  listPapersInputSchema,
  organizePaperInputSchema,
  paperCommandSchema,
  updatePaperInputSchema,
} from '@studycommit/rpc-contracts/papers'
import { z } from 'zod'
import { CurrentUserId } from '../common/current-user'
import { IdentityGuard } from '../auth/identity.guard'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import { ZodPipe } from '../common/zod.pipe'
import { PapersService } from './papers.service'

@Controller('papers')
@UseGuards(IdentityGuard)
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

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Body(new ZodPipe(updatePaperInputSchema.omit({ id: true })))
    body: { content: string; version: number },
  ) {
    return this.papers.update(userId, { id, ...body })
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

  @Post(':id/move-to-inbox')
  @HttpCode(200)
  moveToInbox(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Body(new ZodPipe(paperCommandSchema.omit({ id: true })))
    body: { version: number },
  ) {
    return this.papers.moveToInbox(userId, { id, ...body })
  }

  @Delete(':id')
  @HttpCode(200)
  remove(
    @CurrentUserId() userId: string,
    @Param('id', new ZodPipe(z.uuid())) id: string,
    @Body(new ZodPipe(paperCommandSchema.omit({ id: true })))
    body: { version: number },
  ) {
    return this.papers.remove(userId, { id, ...body })
  }
}
