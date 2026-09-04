import { Controller, Headers, Inject, Req, UseGuards } from '@nestjs/common'
import { topicContract } from '@studycommit/rpc-contracts/topics'
import { Implement, implement } from '@orpc/nest'
import type { AuthedRequest } from '../auth/access-token.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import { handleOrpc } from '../common/orpc-error'
import { createTopicSchema, updateTopicSchema } from './topic.schemas'
import type { TopicWithTemplate } from './topics.repository'
import { TopicsService } from './topics.service'

function toTopicOutput(topic: TopicWithTemplate) {
  return {
    ...topic,
    lastPaperAt: topic.lastPaperAt?.toISOString() ?? null,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    deletedAt: topic.deletedAt?.toISOString() ?? null,
  }
}

@Controller()
@UseGuards(IdentityGuard)
export class TopicsRpcController {
  constructor(@Inject(TopicsService) private readonly topics: TopicsService) {}

  @Implement(topicContract)
  topicsRouter(
    @Req() request: AuthedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return {
      list: implement(topicContract.list).handler(({ input }) =>
        handleOrpc(() => this.topics.list(request.userId, input)).then((page) => ({
          ...page,
          items: page.items.map(toTopicOutput),
        })),
      ),
      get: implement(topicContract.get).handler(({ input }) =>
        handleOrpc(() => this.topics.get(request.userId, input.id)).then(toTopicOutput),
      ),
      create: implement(topicContract.create).handler(({ input, context }) =>
        handleOrpc(async () => {
          const result = await this.topics.create(
            request.userId,
            createTopicSchema.parse(input),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return toTopicOutput(result.topic)
        }),
      ),
      update: implement(topicContract.update).handler(({ input }) => {
        const { id, ...changes } = input
        return handleOrpc(() =>
          this.topics.update(request.userId, id, updateTopicSchema.parse(changes)),
        ).then(toTopicOutput)
      }),
      remove: implement(topicContract.remove).handler(({ input }) =>
        handleOrpc(() => this.topics.remove(request.userId, input.id, input.version)),
      ),
    }
  }
}
