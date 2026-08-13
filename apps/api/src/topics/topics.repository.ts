import { Injectable } from '@nestjs/common'
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { idempotencyRecords, topics } from '../database/schema'
import type { CreateTopicInput, ListTopicsInput, UpdateTopicInput } from './topic.schemas'

export type Topic = typeof topics.$inferSelect
type Cursor = { updatedAt: string; id: string }
const encodeCursor = (topic: Topic) => Buffer.from(JSON.stringify({ updatedAt: topic.updatedAt.toISOString(), id: topic.id })).toString('base64url')
function decodeCursor(value: string): Cursor { try { const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()); if (!parsed.updatedAt || !parsed.id) throw new Error(); return parsed } catch { throw new Error('INVALID_CURSOR') } }

@Injectable()
export class TopicsRepository {
  constructor(private readonly database: DatabaseService) {}
  async findById(userId: string, id: string, includeDeleted = false) {
    const conditions = [eq(topics.userId, userId), eq(topics.id, id)]
    if (!includeDeleted) conditions.push(isNull(topics.deletedAt))
    const [topic] = await this.database.db.select().from(topics).where(and(...conditions)).limit(1)
    return topic ?? null
  }
  async findIdempotency(userId: string, key: string) {
    const [record] = await this.database.db.select().from(idempotencyRecords).where(and(eq(idempotencyRecords.userId, userId), eq(idempotencyRecords.key, key))).limit(1)
    return record ?? null
  }
  async create(userId: string, input: CreateTopicInput, idempotency: { key: string; hash: string }) {
    return this.database.db.transaction(async (tx) => {
      const [topic] = await tx.insert(topics).values({ userId, ...input }).returning()
      await tx.insert(idempotencyRecords).values({ userId, key: idempotency.key, requestHash: idempotency.hash, resourceType: 'topic', resourceId: topic.id, response: topic })
      return topic
    })
  }
  async list(userId: string, input: ListTopicsInput) {
    const conditions = [eq(topics.userId, userId), isNull(topics.deletedAt)]
    if (input.status) conditions.push(eq(topics.status, input.status))
    if (input.cursor) { const cursor = decodeCursor(input.cursor); conditions.push(or(gt(topics.updatedAt, new Date(cursor.updatedAt)), and(eq(topics.updatedAt, new Date(cursor.updatedAt)), gt(topics.id, cursor.id)))!) }
    const rows = await this.database.db.select().from(topics).where(and(...conditions)).orderBy(asc(topics.updatedAt), asc(topics.id)).limit(input.limit + 1)
    const hasNextPage = rows.length > input.limit
    const items = rows.slice(0, input.limit)
    return { items, pageInfo: { hasNextPage, nextCursor: hasNextPage ? encodeCursor(items.at(-1)!) : null } }
  }
  async update(userId: string, id: string, input: UpdateTopicInput) {
    const { version, ...changes } = input
    const [topic] = await this.database.db.update(topics).set({ ...changes, version: sql`${topics.version} + 1`, updatedAt: new Date() }).where(and(eq(topics.userId, userId), eq(topics.id, id), eq(topics.version, version), isNull(topics.deletedAt))).returning()
    return topic ?? null
  }
  async remove(userId: string, id: string, version: number) {
    const [topic] = await this.database.db.update(topics).set({ deletedAt: new Date(), version: sql`${topics.version} + 1`, updatedAt: new Date() }).where(and(eq(topics.userId, userId), eq(topics.id, id), eq(topics.version, version), isNull(topics.deletedAt))).returning()
    return topic ?? null
  }
}
