import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { learningRecordContract } from '@studycommit/rpc-contracts/learning-records'
import type { AuthedRequest } from '../auth/access-token.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { listLearningLogsQuerySchema, updateLearningLogSchema } from './learning-log.schemas'
import { LearningLogsService } from './learning-logs.service'

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

function toCompletionSource(value: string | null): 'online' | 'offline_sync' | null {
  if (value === 'online' || value === 'offline_sync') {
    return value
  }
  return null
}

function toLearningLogOutput<T extends { createdAt: Date; updatedAt: Date }>(log: T) {
  return { ...log, createdAt: log.createdAt.toISOString(), updatedAt: log.updatedAt.toISOString() }
}

function toSessionOutput<
  T extends {
    startedAt: Date
    pausedAt: Date | null
    completedAt: Date | null
    completionSource: string | null
    createdAt: Date
    updatedAt: Date
  },
>(session: T) {
  return {
    ...session,
    startedAt: session.startedAt.toISOString(),
    pausedAt: toIso(session.pausedAt),
    completedAt: toIso(session.completedAt),
    completionSource: toCompletionSource(session.completionSource),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

function toTopicRowOutput<T extends { createdAt: Date; updatedAt: Date; deletedAt: Date | null }>(
  topic: T,
) {
  return {
    ...topic,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    deletedAt: toIso(topic.deletedAt),
  }
}

@Controller()
@UseGuards(IdentityGuard)
export class LearningLogsRpcController {
  constructor(@Inject(LearningLogsService) private readonly logs: LearningLogsService) {}

  @Implement(learningRecordContract)
  learningLogsRouter(@Req() request: AuthedRequest) {
    return {
      list: implement(learningRecordContract.list).handler(({ input }) =>
        handleOrpc(async () => {
          const page = await this.logs.list(
            request.userId,
            listLearningLogsQuerySchema.parse(input ?? {}),
          )
          return {
            ...page,
            items: page.items.map((item) => ({
              learningLog: toLearningLogOutput(item.learningLog),
              session: toSessionOutput(item.session),
              topic: toTopicRowOutput(item.topic),
            })),
          }
        }),
      ),
      bySession: implement(learningRecordContract.bySession).handler(({ input }) =>
        handleOrpc(async () =>
          toLearningLogOutput(await this.logs.getBySession(request.userId, input.sessionId)),
        ),
      ),
      update: implement(learningRecordContract.update).handler(({ input }) => {
        const { id, ...body } = input
        return handleOrpc(async () =>
          toLearningLogOutput(
            await this.logs.update(request.userId, id, updateLearningLogSchema.parse(body)),
          ),
        )
      }),
    }
  }
}
