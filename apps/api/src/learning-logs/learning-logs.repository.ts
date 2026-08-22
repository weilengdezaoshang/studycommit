import { Inject, Injectable } from '@nestjs/common'
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { learningLogs, studySessions, topics } from '../database/schema'
import { LEARNING_LOG_KIND } from './learning-log.constants'
import type { ListLearningLogsQuery, UpdateLearningLogInput } from './learning-log.schemas'

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

  async list(userId: string, query: ListLearningLogsQuery) {
    const filters = [
      eq(learningLogs.userId, userId),
      eq(studySessions.userId, userId),
      eq(topics.userId, userId),
      eq(studySessions.status, 'completed' as const),
    ]
    if (query.topicId) {
      filters.push(eq(studySessions.topicId, query.topicId))
    }
    if (query.from) {
      filters.push(gte(studySessions.completedAt, new Date(query.from)))
    }
    if (query.to) {
      filters.push(lte(studySessions.completedAt, new Date(query.to)))
    }
    const offset = (query.page - 1) * query.pageSize
    const [items, [{ total }]] = await Promise.all([
      this.database.db
        .select({ learningLog: learningLogs, session: studySessions, topic: topics })
        .from(learningLogs)
        .innerJoin(studySessions, eq(studySessions.id, learningLogs.sessionId))
        .innerJoin(topics, eq(topics.id, studySessions.topicId))
        .where(and(...filters))
        .orderBy(desc(studySessions.completedAt), desc(learningLogs.id))
        .limit(query.pageSize)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(learningLogs)
        .innerJoin(studySessions, eq(studySessions.id, learningLogs.sessionId))
        .innerJoin(topics, eq(topics.id, studySessions.topicId))
        .where(and(...filters)),
    ])
    return { items, page: query.page, pageSize: query.pageSize, total: Number(total) }
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
