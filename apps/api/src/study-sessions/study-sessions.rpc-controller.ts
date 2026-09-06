import { Controller, Headers, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { studySessionContract } from '@studycommit/rpc-contracts/study-sessions'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { IDEMPOTENCY_REPLAYED_HEADER, requireIdempotencyKey } from '../common/idempotency'
import {
  completePaperSchema,
  completeStudySessionSchema,
  createSessionFragmentSchema,
  createStudySessionSchema,
  sessionCommandSchema,
  updateSessionFragmentSchema,
} from './study-session.schemas'
import type { LearningLog, PaperFragment, StudySession } from './study-sessions.repository'
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

type SessionRow = Omit<
  StudySession,
  'startedAt' | 'pausedAt' | 'completedAt' | 'createdAt' | 'updatedAt'
> & {
  startedAt: Date | string
  pausedAt: Date | string | null
  completedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

function toSessionSource(
  value: string,
): 'manual_topic' | 'desktop_capture' | 'desktop_existing_question' {
  return value === 'desktop_capture' || value === 'desktop_existing_question'
    ? value
    : 'manual_topic'
}

function toSessionOutput(session: SessionRow) {
  return {
    ...session,
    source: toSessionSource(session.source),
    startedAt: toIso(session.startedAt),
    pausedAt: toNullableIso(session.pausedAt),
    completedAt: toNullableIso(session.completedAt),
    completionSource: toCompletionSource(session.completionSource),
    createdAt: toIso(session.createdAt),
    updatedAt: toIso(session.updatedAt),
  }
}

function toFragmentOutput(
  fragment: Omit<PaperFragment, 'createdAt' | 'updatedAt'> & {
    createdAt: Date | string
    updatedAt: Date | string
  },
) {
  return {
    ...fragment,
    createdAt: toIso(fragment.createdAt),
    updatedAt: toIso(fragment.updatedAt),
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

type PaperRowLike = {
  id: string
  userId: string
  content: string
  topicId: string | null
  hasQuestion: boolean
  isQuestionResolved: boolean
  questionStatus: 'none' | 'thinking' | 'resolved'
  questionText: string | null
  understandingText: string | null
  questionResolvedAt: Date | string | null
  source: string
  sourceSessionId: string | null
  version: number
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

function toPaperOutput(paper: PaperRowLike): Paper {
  const source: Paper['source'] =
    paper.source === 'desktop_capture' || paper.source === 'desktop_session'
      ? paper.source
      : 'mobile_direct'
  return {
    id: paper.id,
    content: paper.content,
    status: paper.topicId ? 'organized' : 'inbox',
    topicId: paper.topicId,
    version: paper.version,
    createdAt: toIso(paper.createdAt),
    updatedAt: toIso(paper.updatedAt),
    deletedAt: toNullableIso(paper.deletedAt),
    hasQuestion: paper.hasQuestion,
    isQuestionResolved: paper.isQuestionResolved,
    questionStatus: paper.questionStatus,
    questionText: paper.questionText,
    understandingText: paper.understandingText,
    questionResolvedAt: toNullableIso(paper.questionResolvedAt),
    source,
    sourceSessionId: paper.sourceSessionId,
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
            paper: snapshot.paper
              ? {
                  id: snapshot.paper.id,
                  questionText: snapshot.paper.questionText,
                  understandingText: snapshot.paper.understandingText,
                  fragmentCount: snapshot.paper.fragmentCount,
                }
              : null,
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
      createFragment: implement(studySessionContract.createFragment).handler(({ input, context }) =>
        handleOrpc(async () => {
          const { id, ...body } = input
          const result = await this.sessions.createFragment(
            request.userId,
            id,
            createSessionFragmentSchema.parse(body),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return toFragmentOutput(result.fragment)
        }),
      ),
      updateFragment: implement(studySessionContract.updateFragment).handler(({ input }) =>
        handleOrpc(async () => {
          const { id, fragmentId, ...body } = input
          const result = await this.sessions.updateFragment(
            request.userId,
            id,
            fragmentId,
            updateSessionFragmentSchema.parse(body),
          )
          return toFragmentOutput(result.fragment)
        }),
      ),
      completePaper: implement(studySessionContract.completePaper).handler(({ input, context }) =>
        handleOrpc(async () => {
          const { id, ...body } = input
          const result = await this.sessions.completePaper(
            request.userId,
            id,
            completePaperSchema.parse(body),
            requireIdempotencyKey(idempotencyKey),
          )
          if (result.replayed) {
            context.resHeaders?.set(IDEMPOTENCY_REPLAYED_HEADER, 'true')
          }
          return {
            session: toSessionOutput(result.session),
            paper: toPaperOutput(result.paper),
            nextPaper: result.nextPaper ? toPaperOutput(result.nextPaper) : null,
          }
        }),
      ),
    }
  }
}
