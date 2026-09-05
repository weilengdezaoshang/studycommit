import { Controller, Headers, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import {
  createPaperInputSchema,
  listPapersInputSchema,
  organizePaperInputSchema,
  paperCommandSchema,
  paperContract,
  updatePaperInputSchema,
  updatePaperQuestionInputSchema,
} from '@studycommit/rpc-contracts/papers'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import { PapersService } from './papers.service'

@Controller()
@UseGuards(IdentityGuard)
export class PapersRpcController {
  constructor(@Inject(PapersService) private readonly papers: PapersService) {}

  @Implement(paperContract)
  papersRouter(
    @Req() request: AuthedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return {
      create: implement(paperContract.create).handler(({ input, context }) =>
        handleOrpc(async () => {
          const result = await this.papers.create(
            request.userId,
            createPaperInputSchema.parse(input),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return result.paper
        }),
      ),
      list: implement(paperContract.list).handler(({ input }) =>
        handleOrpc(() =>
          this.papers.list(request.userId, listPapersInputSchema.parse(input ?? {})),
        ),
      ),
      get: implement(paperContract.get).handler(({ input }) =>
        handleOrpc(() => this.papers.get(request.userId, input.id)),
      ),
      update: implement(paperContract.update).handler(({ input }) =>
        handleOrpc(() => this.papers.update(request.userId, updatePaperInputSchema.parse(input))),
      ),
      organize: implement(paperContract.organize).handler(({ input }) =>
        handleOrpc(() =>
          this.papers.organize(request.userId, organizePaperInputSchema.parse(input)),
        ),
      ),
      moveToInbox: implement(paperContract.moveToInbox).handler(({ input }) =>
        handleOrpc(() => this.papers.moveToInbox(request.userId, paperCommandSchema.parse(input))),
      ),
      remove: implement(paperContract.remove).handler(({ input }) =>
        handleOrpc(() => this.papers.remove(request.userId, paperCommandSchema.parse(input))),
      ),
      question: implement(paperContract.question).handler(({ input }) =>
        handleOrpc(() =>
          this.papers.updateQuestion(request.userId, updatePaperQuestionInputSchema.parse(input)),
        ),
      ),
      restore: implement(paperContract.restore).handler(({ input }) =>
        handleOrpc(() => this.papers.restore(request.userId, paperCommandSchema.parse(input))),
      ),
    }
  }
}
