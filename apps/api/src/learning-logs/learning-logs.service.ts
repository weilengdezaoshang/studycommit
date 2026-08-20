import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { LEARNING_LOG_ERROR, LEARNING_LOG_KIND } from './learning-log.constants'
import type { UpdateLearningLogInput } from './learning-log.schemas'
import { LearningLogsRepository } from './learning-logs.repository'

@Injectable()
export class LearningLogsService {
  constructor(
    @Inject(LearningLogsRepository) private readonly repository: LearningLogsRepository,
  ) {}

  async getBySession(userId: string, sessionId: string) {
    const learningLog = await this.repository.findBySession(userId, sessionId)
    if (!learningLog) {
      throw new NotFoundException(LEARNING_LOG_ERROR.notFound)
    }
    return learningLog
  }

  async update(userId: string, id: string, input: UpdateLearningLogInput) {
    const result = await this.repository.update(userId, id, input)
    if (result.kind === LEARNING_LOG_KIND.ok) {
      return result.learningLog
    }
    if (result.kind === LEARNING_LOG_KIND.missing) {
      throw new NotFoundException(LEARNING_LOG_ERROR.notFound)
    }
    throw new ConflictException({
      ...LEARNING_LOG_ERROR.versionConflict,
      details: { learningLog: result.learningLog },
    })
  }
}
