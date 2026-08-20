import { Inject, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { learningLogs } from '../database/schema'
import { LEARNING_LOG_KIND } from './learning-log.constants'
import type { UpdateLearningLogInput } from './learning-log.schemas'

export type LearningLog = typeof learningLogs.$inferSelect
export type LearningLogUpdateResult =
  | { kind: typeof LEARNING_LOG_KIND.ok; learningLog: LearningLog }
  | { kind: typeof LEARNING_LOG_KIND.missing }
  | { kind: typeof LEARNING_LOG_KIND.versionConflict; learningLog: LearningLog }

@Injectable()
export class LearningLogsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findBySession(userId: string, sessionId: string) {
    const [learningLog] = await this.database.db
      .select()
      .from(learningLogs)
      .where(and(eq(learningLogs.userId, userId), eq(learningLogs.sessionId, sessionId)))
      .limit(1)
    return learningLog ?? null
  }

  async findById(userId: string, id: string) {
    const [learningLog] = await this.database.db
      .select()
      .from(learningLogs)
      .where(and(eq(learningLogs.userId, userId), eq(learningLogs.id, id)))
      .limit(1)
    return learningLog ?? null
  }

  async update(
    userId: string,
    id: string,
    input: UpdateLearningLogInput,
  ): Promise<LearningLogUpdateResult> {
    return this.database.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(learningLogs)
        .where(and(eq(learningLogs.userId, userId), eq(learningLogs.id, id)))
        .for('update')
        .limit(1)
      if (!current) {
        return { kind: LEARNING_LOG_KIND.missing }
      }
      if (current.version !== input.version) {
        return { kind: LEARNING_LOG_KIND.versionConflict, learningLog: current }
      }
      if (isUnchanged(current, input)) {
        return { kind: LEARNING_LOG_KIND.ok, learningLog: current }
      }
      const [updated] = await tx
        .update(learningLogs)
        .set({
          ...(input.gains !== undefined ? { gains: input.gains } : {}),
          ...(input.problems !== undefined ? { problems: input.problems } : {}),
          ...(input.nextStep !== undefined ? { nextStep: input.nextStep } : {}),
          version: sql`${learningLogs.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(learningLogs.id, id))
        .returning()
      return { kind: LEARNING_LOG_KIND.ok, learningLog: updated }
    })
  }
}

function isUnchanged(current: LearningLog, input: UpdateLearningLogInput) {
  if (input.gains !== undefined && input.gains !== current.gains) {
    return false
  }
  if (input.problems !== undefined && input.problems !== current.problems) {
    return false
  }
  if (input.nextStep !== undefined && input.nextStep !== current.nextStep) {
    return false
  }
  return true
}
