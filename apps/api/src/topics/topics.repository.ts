import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { isConstraint } from '../common/idempotency'
import { DatabaseService } from '../database/database.service'
import { idempotencyRecords, papers, studySessions, templates, topics } from '../database/schema'
import { SESSION_STATUS } from '../study-sessions/study-session.constants'
import { DEFAULT_TEMPLATE_ID } from '../templates/template.constants'
import {
  TOPIC_CREATE_KIND,
  TOPIC_REMOVE_KIND,
  TOPIC_RESOURCE_TYPE,
  TOPICS_USER_NAME_UNIQUE,
  type TopicRemoveKind,
} from './topic.constants'
import type { CreateTopicInput, ListTopicsInput, UpdateTopicInput } from './topic.schemas'

export type Topic = typeof topics.$inferSelect
export type TemplateSummary = {
  id: string
  name: string
  icon: string
  paperBackground: TopicTemplateBackground
}
type TopicTemplateBackground = 'plain' | 'dot' | 'rule' | 'grid'
export type TopicWithTemplate = Topic & {
  template: TemplateSummary
  paperCount: number
  lastPaperAt: Date | null
}
export type TopicCreateResult =
  | { kind: typeof TOPIC_CREATE_KIND.ok; topic: TopicWithTemplate; replayed: boolean }
  | { kind: typeof TOPIC_CREATE_KIND.idempotencyConflict }
  | { kind: typeof TOPIC_CREATE_KIND.nameConflict }
  | { kind: typeof TOPIC_CREATE_KIND.templateNotFound }
export type TopicRemoveResult = { kind: TopicRemoveKind }

const templateSummary = {
  id: templates.id,
  name: templates.name,
  icon: templates.icon,
  paperBackground: templates.paperBackground,
}

const paperCountSql = sql<number>`coalesce((
  select count(*)::int from ${papers}
  where ${papers.topicId} = ${topics.id}
    and ${papers.userId} = ${topics.userId}
    and ${papers.deletedAt} is null
), 0)`.mapWith(Number)

const lastPaperAtSql = sql<Date | null>`(
  select max(${papers.updatedAt}) from ${papers}
  where ${papers.topicId} = ${topics.id}
    and ${papers.userId} = ${topics.userId}
    and ${papers.deletedAt} is null
)`

const topicQueryColumns = {
  topic: topics,
  template: templateSummary,
  paperCount: paperCountSql,
  lastPaperAt: lastPaperAtSql,
}

function toTopicWithTemplate(row: {
  topic: Topic
  template: TemplateSummary
  paperCount: number
  lastPaperAt: Date | null
}): TopicWithTemplate {
  return {
    ...row.topic,
    template: row.template,
    paperCount: row.paperCount,
    lastPaperAt: row.lastPaperAt ? new Date(row.lastPaperAt) : null,
  }
}

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
    const [row] = await this.database.db
      .select(topicQueryColumns)
      .from(topics)
      .innerJoin(templates, eq(templates.id, topics.templateId))
      .where(and(...conditions))
      .limit(1)
    return row ? toTopicWithTemplate(row) : null
  }

  async create(
    userId: string,
    input: CreateTopicInput,
    idempotency: { key: string; hash: string },
  ): Promise<TopicCreateResult> {
    const templateId = input.templateId ?? DEFAULT_TEMPLATE_ID
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
        const [row] = await tx
          .select(topicQueryColumns)
          .from(topics)
          .innerJoin(templates, eq(templates.id, topics.templateId))
          .where(and(eq(topics.userId, userId), eq(topics.id, record.resourceId)))
          .limit(1)
        return row
          ? { kind: TOPIC_CREATE_KIND.ok, topic: toTopicWithTemplate(row), replayed: true }
          : { kind: TOPIC_CREATE_KIND.idempotencyConflict }
      }

      const [template] = await tx
        .select(templateSummary)
        .from(templates)
        .where(
          and(
            eq(templates.id, templateId),
            isNull(templates.deletedAt),
            or(isNull(templates.userId), eq(templates.userId, userId)),
          ),
        )
        .limit(1)
      if (!template) {
        return { kind: TOPIC_CREATE_KIND.templateNotFound }
      }

      try {
        const [topic] = await tx
          .insert(topics)
          .values({ userId, ...input, templateId })
          .returning()
        await tx.insert(idempotencyRecords).values({
          userId,
          key: idempotency.key,
          requestHash: idempotency.hash,
          resourceType: TOPIC_RESOURCE_TYPE,
          resourceId: topic.id,
          response: topic,
        })
        return {
          kind: TOPIC_CREATE_KIND.ok,
          topic: { ...topic, template, paperCount: 0, lastPaperAt: null },
          replayed: false,
        }
      } catch (error) {
        if (isConstraint(error, TOPICS_USER_NAME_UNIQUE)) {
          return { kind: TOPIC_CREATE_KIND.nameConflict }
        }
        throw error
      }
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
      .select(topicQueryColumns)
      .from(topics)
      .innerJoin(templates, eq(templates.id, topics.templateId))
      .where(and(...conditions))
      .orderBy(asc(updatedAtMilliseconds), asc(topics.id))
      .limit(input.limit + 1)
    const hasNextPage = rows.length > input.limit
    const items = rows.slice(0, input.limit).map(toTopicWithTemplate)
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
    if (!topic) {
      return null
    }
    return this.findById(userId, topic.id)
  }

  async remove(userId: string, id: string, version: number): Promise<TopicRemoveResult> {
    return this.database.db.transaction(async (tx) => {
      const [topic] = await tx
        .select({ id: topics.id, version: topics.version })
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
      if (topic.version !== version) {
        return { kind: TOPIC_REMOVE_KIND.versionConflict }
      }

      await tx
        .select({ id: papers.id })
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.topicId, id), isNull(papers.deletedAt)))
        .orderBy(asc(papers.id))
        .for('update')
      await tx
        .update(papers)
        .set({
          topicId: null,
          version: sql`${papers.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(papers.userId, userId), eq(papers.topicId, id), isNull(papers.deletedAt)))

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
