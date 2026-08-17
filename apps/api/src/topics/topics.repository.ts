import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { idempotencyRecords, studySessions, topics } from '../database/schema'
import { SESSION_STATUS } from '../study-sessions/study-session.constants'
import {
  TOPIC_CREATE_KIND,
  TOPIC_REMOVE_KIND,
  TOPIC_RESOURCE_TYPE,
  type TopicRemoveKind,
} from './topic.constants'
import type { CreateTopicInput, ListTopicsInput, UpdateTopicInput } from './topic.schemas'

export type Topic = typeof topics.$inferSelect
export type TopicCreateResult =
  | { kind: typeof TOPIC_CREATE_KIND.ok; topic: Topic; replayed: boolean }
  | { kind: typeof TOPIC_CREATE_KIND.idempotencyConflict }
export type TopicRemoveResult = { kind: TopicRemoveKind }

type Cursor = { updatedAt: string; id: string }

const encodeCursor = (topic: Topic) =>
  Buffer.from(JSON.stringify({ updatedAt: topic.updatedAt.toISOString(), id: topic.id })).toString(
    'base64url',
  )

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString())
    if (!parsed.updatedAt || !parsed.id) {
      throw new Error()
    }
    return parsed
  } catch {
    throw new Error('INVALID_CURSOR')
  }
}

@Injectable()
export class TopicsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findById(userId: string, id: string, includeDeleted = false) {
    const conditions = [eq(topics.userId, userId), eq(topics.id, id)]
    if (!includeDeleted) {
      conditions.push(isNull(topics.deletedAt))
    }
    const [topic] = await this.database.db
      .select()
      .from(topics)
      .where(and(...conditions))
      .limit(1)
    return topic ?? null
  }

  async create(
    userId: string,
    input: CreateTopicInput,
    idempotency: { key: string; hash: string },
  ): Promise<TopicCreateResult> {
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
          record.resourceType !== TOPIC_RESOURCE_TYPE
        ) {
          return { kind: TOPIC_CREATE_KIND.idempotencyConflict }
        }
        return { kind: TOPIC_CREATE_KIND.ok, topic: record.response as Topic, replayed: true }
      }

      const [topic] = await tx
        .insert(topics)
        .values({ userId, ...input })
        .returning()
      await tx.insert(idempotencyRecords).values({
        userId,
        key: idempotency.key,
        requestHash: idempotency.hash,
        resourceType: TOPIC_RESOURCE_TYPE,
        resourceId: topic.id,
        response: topic,
      })
      return { kind: TOPIC_CREATE_KIND.ok, topic, replayed: false }
    })
  }

  async list(userId: string, input: ListTopicsInput) {
    const conditions = [eq(topics.userId, userId), isNull(topics.deletedAt)]
    const updatedAtMilliseconds = sql<Date>`date_trunc('milliseconds', ${topics.updatedAt})`
    if (input.status) {
      conditions.push(eq(topics.status, input.status))
    }
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor)
      conditions.push(
        or(
          gt(updatedAtMilliseconds, new Date(cursor.updatedAt)),
          and(eq(updatedAtMilliseconds, new Date(cursor.updatedAt)), gt(topics.id, cursor.id)),
        )!,
      )
    }
    const rows = await this.database.db
      .select()
      .from(topics)
      .where(and(...conditions))
      .orderBy(asc(updatedAtMilliseconds), asc(topics.id))
      .limit(input.limit + 1)
    const hasNextPage = rows.length > input.limit
    const items = rows.slice(0, input.limit)
    return {
      items,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage ? encodeCursor(items.at(-1)!) : null,
      },
    }
  }

  async update(userId: string, id: string, input: UpdateTopicInput) {
    const { version, ...changes } = input
    const [topic] = await this.database.db
      .update(topics)
      .set({ ...changes, version: sql`${topics.version} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(topics.userId, userId),
          eq(topics.id, id),
          eq(topics.version, version),
          isNull(topics.deletedAt),
        ),
      )
      .returning()
    return topic ?? null
  }

  async remove(userId: string, id: string, version: number): Promise<TopicRemoveResult> {
    return this.database.db.transaction(async (tx) => {
      const [topic] = await tx
        .select({ id: topics.id })
        .from(topics)
        .where(and(eq(topics.userId, userId), eq(topics.id, id), isNull(topics.deletedAt)))
        .for('update')
        .limit(1)
      if (!topic) {
        return { kind: TOPIC_REMOVE_KIND.missing }
      }

      const [active] = await tx
        .select({ id: studySessions.id })
        .from(studySessions)
        .where(
          and(
            eq(studySessions.userId, userId),
            eq(studySessions.topicId, id),
            or(
              eq(studySessions.status, SESSION_STATUS.running),
              eq(studySessions.status, SESSION_STATUS.paused),
            )!,
          ),
        )
        .limit(1)
      if (active) {
        return { kind: TOPIC_REMOVE_KIND.activeSession }
      }

      const [removed] = await tx
        .update(topics)
        .set({ deletedAt: new Date(), version: sql`${topics.version} + 1`, updatedAt: new Date() })
        .where(
          and(
            eq(topics.id, id),
            eq(topics.userId, userId),
            eq(topics.version, version),
            isNull(topics.deletedAt),
          ),
        )
        .returning({ id: topics.id })
      return { kind: removed ? TOPIC_REMOVE_KIND.removed : TOPIC_REMOVE_KIND.versionConflict }
    })
  }
}
