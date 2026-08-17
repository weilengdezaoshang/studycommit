import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { createHash } from 'node:crypto'
import { IDEMPOTENCY_ERROR, IDEMPOTENCY_RECORDS_PKEY, isConstraint } from '../common/idempotency'
import {
  TOPIC_CREATE_KIND,
  TOPIC_ERROR,
  TOPIC_REMOVE_KIND,
  type TopicRemoveKind,
} from './topic.constants'
import { TopicsRepository } from './topics.repository'
import type { CreateTopicInput, ListTopicsInput, UpdateTopicInput } from './topic.schemas'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

const removeErrors: Record<
  Exclude<TopicRemoveKind, typeof TOPIC_REMOVE_KIND.removed>,
  () => Error
> = {
  [TOPIC_REMOVE_KIND.missing]: () => new NotFoundException(TOPIC_ERROR.notFound),
  [TOPIC_REMOVE_KIND.activeSession]: () => new ConflictException(TOPIC_ERROR.hasActiveSession),
  [TOPIC_REMOVE_KIND.versionConflict]: () => new ConflictException(TOPIC_ERROR.versionConflict),
}

@Injectable()
export class TopicsService {
  constructor(@Inject(TopicsRepository) private readonly repository: TopicsRepository) {}

  async create(userId: string, input: CreateTopicInput, key: string) {
    const requestHash = hash(input)
    try {
      return this.handleCreateResult(
        await this.repository.create(userId, input, { key, hash: requestHash }),
      )
    } catch (error) {
      if (isConstraint(error, IDEMPOTENCY_RECORDS_PKEY)) {
        return this.handleCreateResult(
          await this.repository.create(userId, input, { key, hash: requestHash }),
        )
      }
      throw error
    }
  }

  async list(userId: string, input: ListTopicsInput) {
    try {
      return await this.repository.list(userId, input)
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CURSOR') {
        throw new BadRequestException({ code: 'INVALID_CURSOR', message: '分页游标无效' })
      }
      throw error
    }
  }

  async get(userId: string, id: string) {
    const topic = await this.repository.findById(userId, id)
    if (!topic) {
      throw new NotFoundException(TOPIC_ERROR.notFound)
    }
    return topic
  }

  async update(userId: string, id: string, input: UpdateTopicInput) {
    const topic = await this.repository.update(userId, id, input)
    if (topic) {
      return topic
    }
    if (!(await this.repository.findById(userId, id))) {
      throw new NotFoundException(TOPIC_ERROR.notFound)
    }
    throw new ConflictException(TOPIC_ERROR.versionConflict)
  }

  async remove(userId: string, id: string, version: number) {
    const result = await this.repository.remove(userId, id, version)
    if (result.kind !== TOPIC_REMOVE_KIND.removed) {
      throw removeErrors[result.kind]()
    }
  }

  private handleCreateResult(result: Awaited<ReturnType<TopicsRepository['create']>>) {
    if (result.kind === TOPIC_CREATE_KIND.ok) {
      return { topic: result.topic, replayed: result.replayed }
    }
    throw new ConflictException(IDEMPOTENCY_ERROR.keyReused)
  }
}
