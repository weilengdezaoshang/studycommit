import { Controller, Headers, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { studySessionContract } from '@studycommit/rpc-contracts/study-sessions'
import type { AuthedRequest } from '../auth/identity.guard'
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

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toNullableIso(value: Date | string | null): string | null {
  return value === null ? null : toIso(value)
}

function toSessionOutput(
  session: Omit<
    StudySession,
    'startedAt' | 'pausedAt' | 'completedAt' | 'createdAt' | 'updatedAt'
  > & {
    startedAt: Date | string
    pausedAt: Date | string | null
    completedAt: Date | string | null
    createdAt: Date | string
    updatedAt: Date | string
  },
) {
  return {
    ...session,
    startedAt: toIso(session.startedAt),
    pausedAt: toNullableIso(session.pausedAt),
    completedAt: toNullableIso(session.completedAt),
    completionSource: toCompletionSource(session.completionSource),
    createdAt: toIso(session.createdAt),
    updatedAt: toIso(session.updatedAt),
  }
}

function toLearningLogOutput(
  log: Omit<LearningLog, 'createdAt' | 'updatedAt'> & {
    createdAt: Date | string
    updatedAt: Date | string
  },
) {
  return {
    ...log,
    createdAt: toIso(log.createdAt),
    updatedAt: toIso(log.updatedAt),
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
