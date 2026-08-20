import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { createHash } from 'node:crypto'
import { IDEMPOTENCY_ERROR, isConstraint } from '../common/idempotency'
import {
  SESSION_COMPLETION_SOURCE,
  SESSION_ERROR,
  SESSION_KIND,
  SESSION_ONE_ACTIVE_CONSTRAINT,
} from './study-session.constants'
import type {
  CompleteStudySessionInput,
  CreateStudySessionInput,
  SessionCommandInput,
} from './study-session.schemas'
import {
  StudySessionsRepository,
  type CompleteCommandResult,
  type SessionCommandResult,
} from './study-sessions.repository'

const requestHash = (operation: string, id: string | null, value: unknown) =>
  createHash('sha256').update(JSON.stringify({ operation, id, value })).digest('hex')
const idempotencyConflict = () => new ConflictException(IDEMPOTENCY_ERROR.keyReused)

@Injectable()
export class StudySessionsService {
  constructor(
    @Inject(StudySessionsRepository) private readonly repository: StudySessionsRepository,
  ) {}

  async create(userId: string, input: CreateStudySessionInput, key: string) {
    const hash = requestHash('create', null, input)
    try {
      const result = await this.repository.create(userId, input, { key, hash })
      return this.handleCreateResult(result)
    } catch (error) {
      if (isConstraint(error, SESSION_ONE_ACTIVE_CONSTRAINT)) {
        return this.handleCreateResult(await this.repository.create(userId, input, { key, hash }))
      }
      throw error
    }
  }

  getActive(userId: string) {
    return this.repository.findActiveSnapshot(userId)
  }

  async get(userId: string, id: string) {
    const session = await this.repository.findById(userId, id)
    if (!session) {
      throw new NotFoundException(SESSION_ERROR.notFound)
    }
    return session
  }

  pause(userId: string, id: string, input: SessionCommandInput, key: string) {
    const hash = requestHash('pause', id, input)
    return this.handleCommand(this.repository.pause(userId, id, input.version, { key, hash }))
  }

  resume(userId: string, id: string, input: SessionCommandInput, key: string) {
    const hash = requestHash('resume', id, input)
    return this.handleCommand(this.repository.resume(userId, id, input.version, { key, hash }))
  }

  async complete(userId: string, id: string, input: CompleteStudySessionInput, key: string) {
    const now = await this.repository.now()
    const completionTime =
      input.completionSource === SESSION_COMPLETION_SOURCE.offlineSync
        ? new Date(input.endedAt!)
        : now
    if (completionTime.getTime() > now.getTime() + 5 * 60 * 1000) {
      throw new BadRequestException(SESSION_ERROR.invalidEndTime)
    }
    const hash = requestHash('complete', id, input)
    return this.handleComplete(
      this.repository.complete(
        userId,
        id,
        input.version,
        completionTime,
        input.completionSource,
        {
          gains: input.gains ?? null,
          problems: input.problems ?? null,
          nextStep: input.nextStep ?? null,
        },
        { key, hash },
      ),
    )
  }

  private async handleComplete(
    promise: Promise<CompleteCommandResult | { kind: typeof SESSION_KIND.invalidTime }>,
  ) {
    const result = await promise
    if (result.kind === SESSION_KIND.ok) {
      return result
    }
    if (result.kind === SESSION_KIND.missing) {
      throw new NotFoundException(SESSION_ERROR.notFound)
    }
    if (result.kind === SESSION_KIND.idempotencyConflict) {
      throw idempotencyConflict()
    }
    if (result.kind === SESSION_KIND.versionConflict) {
      throw new ConflictException({
        ...SESSION_ERROR.versionConflict,
        details: { session: result.session },
      })
    }
    if (result.kind === SESSION_KIND.invalidTime) {
      throw new BadRequestException(SESSION_ERROR.invalidEndTimeOrder)
    }
    if (result.kind === SESSION_KIND.inconsistent) {
      throw new ConflictException(SESSION_ERROR.learningLogInconsistent)
    }
    throw new Error(`Unexpected complete result: ${(result as { kind: string }).kind}`)
  }

  private async handleCommand(
    promise: Promise<SessionCommandResult | { kind: typeof SESSION_KIND.invalidTime }>,
  ) {
    const result = await promise
    if (result.kind === SESSION_KIND.ok) {
      return result
    }
    if (result.kind === SESSION_KIND.missing) {
      throw new NotFoundException(SESSION_ERROR.notFound)
    }
    if (result.kind === SESSION_KIND.idempotencyConflict) {
      throw idempotencyConflict()
    }
    if (result.kind === SESSION_KIND.versionConflict) {
      throw new ConflictException({
        ...SESSION_ERROR.versionConflict,
        details: { session: result.session },
      })
    }
    if (result.kind === SESSION_KIND.invalidTime) {
      throw new BadRequestException(SESSION_ERROR.invalidEndTimeOrder)
    }
    throw new Error(`Unexpected command result: ${(result as { kind: string }).kind}`)
  }

  private handleCreateResult(result: Awaited<ReturnType<StudySessionsRepository['create']>>) {
    if (result.kind === SESSION_KIND.ok) {
      return result
    }
    if (result.kind === SESSION_KIND.idempotencyConflict) {
      throw idempotencyConflict()
    }
    if (result.kind === SESSION_KIND.topicMissing) {
      throw new NotFoundException(SESSION_ERROR.topicMissing)
    }
    if (result.kind === SESSION_KIND.activeExists) {
      throw new ConflictException({
        ...SESSION_ERROR.activeExists,
        details: { sessionId: result.session.id, status: result.session.status },
      })
    }
    throw new Error(`Unexpected create result: ${result.kind}`)
  }
}
