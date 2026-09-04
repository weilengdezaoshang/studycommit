import { Controller, Headers, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { studySessionContract } from '@studycommit/rpc-contracts/study-sessions'
import type { AuthedRequest } from '../auth/access-token.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import {
  completeStudySessionSchema,
  createStudySessionSchema,
  sessionCommandSchema,
} from './study-session.schemas'
import type { LearningLog, StudySession } from './study-sessions.repository'
import { StudySessionsService } from './study-sessions.service'

function toCompletionSource(value: string | null): 'online' | 'offline_sync' | null {
  if (value === 'online' || value === 'offline_sync') {
    return value
  }
  return null
}

function toSessionOutput(session: StudySession) {
  return {
    ...session,
    startedAt: session.startedAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    completionSource: toCompletionSource(session.completionSource),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

function toLearningLogOutput(log: LearningLog) {
  return {
    ...log,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  }
}

@Controller()
@UseGuards(IdentityGuard)
export class StudySessionsRpcController {
  constructor(@Inject(StudySessionsService) private readonly sessions: StudySessionsService) {}

  @Implement(studySessionContract)
  sessionsRouter(
    @Req() request: AuthedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return {
      start: implement(studySessionContract.start).handler(({ input, context }) =>
        handleOrpc(async () => {
          const result = await this.sessions.create(
            request.userId,
            createStudySessionSchema.parse(input),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return toSessionOutput(result.session)
        }),
      ),
      active: implement(studySessionContract.active).handler(() =>
        handleOrpc(async () => {
          const snapshot = await this.sessions.getActive(request.userId)
          return {
            session: snapshot.session ? toSessionOutput(snapshot.session) : null,
            serverNow: snapshot.serverNow.toISOString(),
          }
        }),
      ),
      byId: implement(studySessionContract.byId).handler(({ input }) =>
        handleOrpc(async () => toSessionOutput(await this.sessions.get(request.userId, input.id))),
      ),
      pause: implement(studySessionContract.pause).handler(({ input, context }) =>
        handleOrpc(async () => {
          const result = await this.sessions.pause(
            request.userId,
            input.id,
            sessionCommandSchema.parse({ version: input.version }),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return toSessionOutput(result.session)
        }),
      ),
      resume: implement(studySessionContract.resume).handler(({ input, context }) =>
        handleOrpc(async () => {
          const result = await this.sessions.resume(
            request.userId,
            input.id,
            sessionCommandSchema.parse({ version: input.version }),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return toSessionOutput(result.session)
        }),
      ),
      complete: implement(studySessionContract.complete).handler(({ input, context }) =>
        handleOrpc(async () => {
          const { id, ...body } = input
          const result = await this.sessions.complete(
            request.userId,
            id,
            completeStudySessionSchema.parse(body),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return {
            session: toSessionOutput(result.session),
            learningLog: toLearningLogOutput(result.learningLog),
          }
        }),
      ),
    }
  }
}
