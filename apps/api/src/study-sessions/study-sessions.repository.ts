import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import type { NodePgTransaction } from 'drizzle-orm/node-postgres'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import * as schema from '../database/schema'
import { idempotencyRecords, learningLogs, studySessions, topics } from '../database/schema'
import { SESSION_KIND, SESSION_RESOURCE_TYPE, SESSION_STATUS } from './study-session.constants'
import type { CreateStudySessionInput } from './study-session.schemas'
import { TOPIC_STATUS } from '../topics/topic.constants'

export type StudySession = typeof studySessions.$inferSelect
export type LearningLog = typeof learningLogs.$inferSelect
export type SessionCommandResult =
  | { kind: typeof SESSION_KIND.ok; session: StudySession; replayed: boolean }
  | { kind: typeof SESSION_KIND.missing }
  | { kind: typeof SESSION_KIND.versionConflict; session: StudySession }
  | { kind: typeof SESSION_KIND.idempotencyConflict }
export type CompleteCommandResult =
  | {
      kind: typeof SESSION_KIND.ok
      session: StudySession
      learningLog: LearningLog
      replayed: boolean
    }
  | { kind: typeof SESSION_KIND.missing }
  | { kind: typeof SESSION_KIND.versionConflict; session: StudySession }
  | { kind: typeof SESSION_KIND.idempotencyConflict }
  | { kind: typeof SESSION_KIND.inconsistent }
export type LearningLogSummary = {
  gains: string | null
  problems: string | null
  nextStep: string | null
}

const activeCondition = or(
  eq(studySessions.status, SESSION_STATUS.running),
  eq(studySessions.status, SESSION_STATUS.paused),
)!
type Transaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>

@Injectable()
export class StudySessionsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findById(userId: string, id: string) {
    const [session] = await this.database.db
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.id, id)))
      .limit(1)
    return session ?? null
  }

  async findActive(userId: string) {
    const [session] = await this.database.db
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), activeCondition))
      .limit(1)
    return session ?? null
  }

  async findActiveSnapshot(userId: string) {
    return this.database.db.transaction(async (tx) => {
      const serverNow = await this.transactionNow(tx)
      const [session] = await tx
        .select()
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), activeCondition))
        .limit(1)
      return { session: session ?? null, serverNow }
    })
  }

  async now() {
    const { rows } = await this.database.pool.query<{ now: Date }>('select now() as now')
    return rows[0].now
  }

  async create(
    userId: string,
    input: CreateStudySessionInput,
    idempotency: { key: string; hash: string },
  ): Promise<
    | SessionCommandResult
    | { kind: typeof SESSION_KIND.topicMissing }
    | { kind: typeof SESSION_KIND.activeExists; session: StudySession }
  > {
    return this.database.db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(idempotencyRecords)
        .where(
          and(eq(idempotencyRecords.userId, userId), eq(idempotencyRecords.key, idempotency.key)),
        )
        .limit(1)
      if (record) {
        if (
          record.requestHash !== idempotency.hash ||
          record.resourceType !== SESSION_RESOURCE_TYPE
        ) {
          return { kind: SESSION_KIND.idempotencyConflict }
        }
        return { kind: SESSION_KIND.ok, session: record.response as StudySession, replayed: true }
      }

      const [topic] = await tx
        .select({ id: topics.id })
        .from(topics)
        .where(
          and(
            eq(topics.userId, userId),
            eq(topics.id, input.topicId),
            isNull(topics.deletedAt),
            eq(topics.status, TOPIC_STATUS.active),
          ),
        )
        .for('share')
        .limit(1)
      if (!topic) {
        return { kind: SESSION_KIND.topicMissing }
      }

      const [active] = await tx
        .select()
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), activeCondition))
        .limit(1)
      if (active) {
        return { kind: SESSION_KIND.activeExists, session: active }
      }

      const [session] = await tx
        .insert(studySessions)
        .values({ userId, topicId: input.topicId, goal: input.goal ?? null })
        .returning()
      await tx.insert(idempotencyRecords).values({
        userId,
        key: idempotency.key,
        requestHash: idempotency.hash,
        resourceType: SESSION_RESOURCE_TYPE,
        resourceId: session.id,
        response: session,
      })
      return { kind: SESSION_KIND.ok, session, replayed: false }
    })
  }

  async pause(
    userId: string,
    id: string,
    version: number,
    idempotency: { key: string; hash: string },
  ): Promise<SessionCommandResult> {
    return this.database.db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), eq(studySessions.id, id)))
        .for('update')
        .limit(1)
      if (!session) {
        return { kind: SESSION_KIND.missing }
      }

      const replay = await this.findCommandReplay(tx, userId, idempotency)
      if (replay) {
        return replay
      }
      if (session.status !== SESSION_STATUS.running) {
        return this.saveNoop(tx, userId, session, idempotency)
      }
      if (session.version !== version) {
        return { kind: SESSION_KIND.versionConflict, session }
      }

      const now = await this.transactionNow(tx)
      const [updated] = await tx
        .update(studySessions)
        .set({
          status: SESSION_STATUS.paused,
          pausedAt: now,
          version: sql`${studySessions.version} + 1`,
          updatedAt: now,
        })
        .where(eq(studySessions.id, id))
        .returning()
      await this.saveIdempotency(tx, userId, updated, idempotency)
      return { kind: SESSION_KIND.ok, session: updated, replayed: false }
    })
  }

  async resume(
    userId: string,
    id: string,
    version: number,
    idempotency: { key: string; hash: string },
  ): Promise<SessionCommandResult> {
    return this.database.db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), eq(studySessions.id, id)))
        .for('update')
        .limit(1)
      if (!session) {
        return { kind: SESSION_KIND.missing }
      }

      const replay = await this.findCommandReplay(tx, userId, idempotency)
      if (replay) {
        return replay
      }
      if (session.status !== SESSION_STATUS.paused) {
        return this.saveNoop(tx, userId, session, idempotency)
      }
      if (session.version !== version) {
        return { kind: SESSION_KIND.versionConflict, session }
      }

      const now = await this.transactionNow(tx)
      const pausedSeconds = Math.max(
        0,
        Math.floor((now.getTime() - session.pausedAt!.getTime()) / 1000),
      )
      const [updated] = await tx
        .update(studySessions)
        .set({
          status: SESSION_STATUS.running,
          pausedAt: null,
          totalPausedSeconds: session.totalPausedSeconds + pausedSeconds,
          version: sql`${studySessions.version} + 1`,
          updatedAt: now,
        })
        .where(eq(studySessions.id, id))
        .returning()
      await this.saveIdempotency(tx, userId, updated, idempotency)
      return { kind: SESSION_KIND.ok, session: updated, replayed: false }
    })
  }

  async complete(
    userId: string,
    id: string,
    version: number,
    completionTime: Date,
    source: 'online' | 'offline_sync',
    summary: LearningLogSummary,
    idempotency: { key: string; hash: string },
  ): Promise<CompleteCommandResult | { kind: typeof SESSION_KIND.invalidTime }> {
    return this.database.db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), eq(studySessions.id, id)))
        .for('update')
        .limit(1)
      if (!session) {
        return { kind: SESSION_KIND.missing }
      }

      const replay = await this.findCompleteReplay(tx, userId, idempotency)
      if (replay) {
        return replay
      }
      if (session.status === SESSION_STATUS.completed) {
        return this.completeAlreadyDone(tx, userId, session, idempotency)
      }
      if (session.version !== version) {
        return { kind: SESSION_KIND.versionConflict, session }
      }
      if (
        completionTime < session.startedAt ||
        (session.pausedAt && completionTime < session.pausedAt)
      ) {
        return { kind: SESSION_KIND.invalidTime }
      }

      let totalPausedSeconds = session.totalPausedSeconds
      if (session.status === SESSION_STATUS.paused) {
        totalPausedSeconds += Math.max(
          0,
          Math.floor((completionTime.getTime() - session.pausedAt!.getTime()) / 1000),
        )
      }
      const durationSeconds = Math.max(
        0,
        Math.floor((completionTime.getTime() - session.startedAt.getTime()) / 1000) -
          totalPausedSeconds,
      )
      const now = await this.transactionNow(tx)
      const [updated] = await tx
        .update(studySessions)
        .set({
          status: SESSION_STATUS.completed,
          pausedAt: null,
          totalPausedSeconds,
          completedAt: completionTime,
          durationSeconds,
          completionSource: source,
          version: sql`${studySessions.version} + 1`,
          updatedAt: now,
        })
        .where(eq(studySessions.id, id))
        .returning()
      const [learningLog] = await tx
        .insert(learningLogs)
        .values({
          userId,
          sessionId: updated.id,
          topicId: updated.topicId,
          gains: summary.gains,
          problems: summary.problems,
          nextStep: summary.nextStep,
          effectiveDurationSeconds: durationSeconds,
        })
        .returning()
      await tx
        .update(topics)
        .set({
          totalDurationSeconds: sql`${topics.totalDurationSeconds} + ${durationSeconds}`,
          updatedAt: now,
        })
        .where(eq(topics.id, updated.topicId))
      await this.saveCompleteIdempotency(tx, userId, updated, learningLog, idempotency)
      return { kind: SESSION_KIND.ok, session: updated, learningLog, replayed: false }
    })
  }

  private async transactionNow(tx: Transaction) {
    const result = await tx.execute(sql`select now() as now`)
    const { now } = result.rows[0] as { now: Date | string }
    return new Date(now)
  }

  private async findCommandReplay(
    tx: Transaction,
    userId: string,
    idempotency: { key: string; hash: string },
  ): Promise<SessionCommandResult | null> {
    const [record] = await tx
      .select()
      .from(idempotencyRecords)
      .where(
        and(eq(idempotencyRecords.userId, userId), eq(idempotencyRecords.key, idempotency.key)),
      )
      .limit(1)
    if (!record) {
      return null
    }
    if (record.requestHash !== idempotency.hash || record.resourceType !== SESSION_RESOURCE_TYPE) {
      return { kind: SESSION_KIND.idempotencyConflict }
    }
    return { kind: SESSION_KIND.ok, session: record.response as StudySession, replayed: true }
  }

  private async saveIdempotency(
    tx: Transaction,
    userId: string,
    session: StudySession,
    idempotency: { key: string; hash: string },
  ) {
    await tx.insert(idempotencyRecords).values({
      userId,
      key: idempotency.key,
      requestHash: idempotency.hash,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: session.id,
      response: session,
    })
  }

  private async saveNoop(
    tx: Transaction,
    userId: string,
    session: StudySession,
    idempotency: { key: string; hash: string },
  ): Promise<SessionCommandResult> {
    await this.saveIdempotency(tx, userId, session, idempotency)
    return { kind: SESSION_KIND.ok, session, replayed: false }
  }

  private async findCompleteReplay(
    tx: Transaction,
    userId: string,
    idempotency: { key: string; hash: string },
  ): Promise<CompleteCommandResult | null> {
    const [record] = await tx
      .select()
      .from(idempotencyRecords)
      .where(
        and(eq(idempotencyRecords.userId, userId), eq(idempotencyRecords.key, idempotency.key)),
      )
      .limit(1)
    if (!record) {
      return null
    }
    if (record.requestHash !== idempotency.hash || record.resourceType !== SESSION_RESOURCE_TYPE) {
      return { kind: SESSION_KIND.idempotencyConflict }
    }
    const stored = record.response
    if (isCompleteResponse(stored)) {
      return { kind: SESSION_KIND.ok, ...stored, replayed: true }
    }
    const session = stored as StudySession
    const learningLog = await this.findLearningLog(tx, userId, session.id)
    if (!learningLog) {
      return { kind: SESSION_KIND.inconsistent }
    }
    return { kind: SESSION_KIND.ok, session, learningLog, replayed: true }
  }

  private async completeAlreadyDone(
    tx: Transaction,
    userId: string,
    session: StudySession,
    idempotency: { key: string; hash: string },
  ): Promise<CompleteCommandResult> {
    const learningLog = await this.findLearningLog(tx, userId, session.id)
    if (!learningLog) {
      return { kind: SESSION_KIND.inconsistent }
    }
    await this.saveCompleteIdempotency(tx, userId, session, learningLog, idempotency)
    return { kind: SESSION_KIND.ok, session, learningLog, replayed: false }
  }

  private async findLearningLog(tx: Transaction, userId: string, sessionId: string) {
    const [learningLog] = await tx
      .select()
      .from(learningLogs)
      .where(and(eq(learningLogs.userId, userId), eq(learningLogs.sessionId, sessionId)))
      .limit(1)
    return learningLog ?? null
  }

  private async saveCompleteIdempotency(
    tx: Transaction,
    userId: string,
    session: StudySession,
    learningLog: LearningLog,
    idempotency: { key: string; hash: string },
  ) {
    await tx.insert(idempotencyRecords).values({
      userId,
      key: idempotency.key,
      requestHash: idempotency.hash,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: session.id,
      response: { session, learningLog },
    })
  }
}

function isCompleteResponse(
  value: unknown,
): value is { session: StudySession; learningLog: LearningLog } {
  return (
    !!value &&
    typeof value === 'object' &&
    'session' in value &&
    'learningLog' in value &&
    !!(value as { session?: unknown }).session &&
    !!(value as { learningLog?: unknown }).learningLog
  )
}
