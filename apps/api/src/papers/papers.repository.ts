import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import type {
  CreatePaperInput,
  ListPapersInput,
  OrganizePaperInput,
} from '@studycommit/rpc-contracts/papers'
import { z } from 'zod'
import { DatabaseService } from '../database/database.service'
import { idempotencyRecords, papers, topics } from '../database/schema'
import { TOPIC_STATUS } from '../topics/topic.constants'
import { PAPER_CREATE_KIND, PAPER_ORGANIZE_KIND, PAPER_RESOURCE_TYPE } from './papers.constants'

export type Paper = typeof papers.$inferSelect
export type PaperCreateResult =
  | { kind: typeof PAPER_CREATE_KIND.ok; paper: Paper; replayed: boolean }
  | { kind: typeof PAPER_CREATE_KIND.idempotencyConflict }

export type PaperOrganizeResult =
  | { kind: typeof PAPER_ORGANIZE_KIND.ok; paper: Paper }
  | { kind: typeof PAPER_ORGANIZE_KIND.notFound }
  | { kind: typeof PAPER_ORGANIZE_KIND.topicNotFound }
  | { kind: typeof PAPER_ORGANIZE_KIND.topicArchived }
  | { kind: typeof PAPER_ORGANIZE_KIND.versionConflict; paper: Paper }

type Cursor = { createdAt: string; id: string }

const encodeCursor = (paper: Paper) =>
  Buffer.from(JSON.stringify({ createdAt: paper.createdAt.toISOString(), id: paper.id })).toString(
    'base64url',
  )

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString())
    return z.object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() }).parse(parsed)
  } catch {
    throw new Error('INVALID_CURSOR')
  }
}

@Injectable()
export class PapersRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findById(userId: string, id: string) {
    const [paper] = await this.database.db
      .select()
      .from(papers)
      .where(and(eq(papers.userId, userId), eq(papers.id, id), isNull(papers.deletedAt)))
      .limit(1)
    return paper ?? null
  }

  async create(
    userId: string,
    input: CreatePaperInput,
    idempotency: { key: string; hash: string },
  ): Promise<PaperCreateResult> {
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
          record.resourceType !== PAPER_RESOURCE_TYPE
        ) {
          return { kind: PAPER_CREATE_KIND.idempotencyConflict }
        }
        const [paper] = await tx
          .select()
          .from(papers)
          .where(and(eq(papers.userId, userId), eq(papers.id, record.resourceId)))
          .limit(1)
        return paper
          ? { kind: PAPER_CREATE_KIND.ok, paper, replayed: true }
          : { kind: PAPER_CREATE_KIND.idempotencyConflict }
      }

      const [paper] = await tx
        .insert(papers)
        .values({ userId, content: input.content, topicId: null })
        .returning()
      await tx.insert(idempotencyRecords).values({
        userId,
        key: idempotency.key,
        requestHash: idempotency.hash,
        resourceType: PAPER_RESOURCE_TYPE,
        resourceId: paper.id,
        response: paper,
      })
      return { kind: PAPER_CREATE_KIND.ok, paper, replayed: false }
    })
  }

  async organize(userId: string, input: OrganizePaperInput): Promise<PaperOrganizeResult> {
    return this.database.db.transaction(async (tx) => {
      const [paper] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: PAPER_ORGANIZE_KIND.notFound }
      }

      const [topic] = await tx
        .select()
        .from(topics)
        .where(
          and(eq(topics.userId, userId), eq(topics.id, input.topicId), isNull(topics.deletedAt)),
        )
        .for('update')
        .limit(1)
      if (!topic) {
        return { kind: PAPER_ORGANIZE_KIND.topicNotFound }
      }
      if (topic.status === TOPIC_STATUS.archived) {
        return { kind: PAPER_ORGANIZE_KIND.topicArchived }
      }
      if (paper.topicId === input.topicId) {
        return { kind: PAPER_ORGANIZE_KIND.ok, paper }
      }
      if (paper.version !== input.version) {
        return { kind: PAPER_ORGANIZE_KIND.versionConflict, paper }
      }

      const [updated] = await tx
        .update(papers)
        .set({
          topicId: input.topicId,
          version: sql`${papers.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(papers.userId, userId),
            eq(papers.id, input.id),
            eq(papers.version, input.version),
            isNull(papers.deletedAt),
          ),
        )
        .returning()
      if (updated) {
        return { kind: PAPER_ORGANIZE_KIND.ok, paper: updated }
      }

      const [latest] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .limit(1)
      if (!latest) {
        return { kind: PAPER_ORGANIZE_KIND.notFound }
      }
      if (latest.topicId === input.topicId) {
        return { kind: PAPER_ORGANIZE_KIND.ok, paper: latest }
      }
      return { kind: PAPER_ORGANIZE_KIND.versionConflict, paper: latest }
    })
  }

  async list(userId: string, input: ListPapersInput) {
    const conditions = [eq(papers.userId, userId), isNull(papers.deletedAt)]
    if (input.topicId) {
      conditions.push(eq(papers.topicId, input.topicId))
    }
    if (input.status === 'inbox') {
      conditions.push(isNull(papers.topicId))
    }
    if (input.status === 'organized') {
      conditions.push(sql`${papers.topicId} is not null`)
    }
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor)
      const createdAt = sql<Date>`date_trunc('milliseconds', ${papers.createdAt})`
      conditions.push(
        or(
          gt(createdAt, new Date(cursor.createdAt)),
          and(eq(createdAt, new Date(cursor.createdAt)), gt(papers.id, cursor.id)),
        )!,
      )
    }
    const createdAt = sql<Date>`date_trunc('milliseconds', ${papers.createdAt})`
    const rows = await this.database.db
      .select()
      .from(papers)
      .where(and(...conditions))
      .orderBy(asc(createdAt), asc(papers.id))
      .limit(input.limit + 1)
    const hasNextPage = rows.length > input.limit
    const items = rows.slice(0, input.limit)
    return {
      items,
      pageInfo: { hasNextPage, nextCursor: hasNextPage ? encodeCursor(items.at(-1)!) : null },
    }
  }
}
