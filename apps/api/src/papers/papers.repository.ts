import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, lt, ne, or, sql } from 'drizzle-orm'
import type {
  CreatePaperInput,
  ListPapersInput,
  OrganizePaperInput,
  PaperCommandInput,
  UpdatePaperQuestionInput,
  UpdatePaperInput,
} from '@studycommit/rpc-contracts/papers'
import { z } from 'zod'
import { DatabaseService } from '../database/database.service'
import { idempotencyRecords, papers, topics } from '../database/schema'
import { TOPIC_STATUS } from '../topics/topic.constants'
import {
  PAPER_COMMAND_KIND,
  PAPER_CREATE_KIND,
  PAPER_ORGANIZE_KIND,
  PAPER_QUESTION_KIND,
  PAPER_RESOURCE_TYPE,
} from './papers.constants'
import { planQuestionTransition } from '@studycommit/rpc-contracts/paper-question'
import { UploadsRepository } from '../uploads/uploads.repository'

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

export type PaperCommandResult =
  | { kind: typeof PAPER_COMMAND_KIND.ok; paper: Paper }
  | { kind: typeof PAPER_COMMAND_KIND.notFound }
  | { kind: typeof PAPER_COMMAND_KIND.versionConflict; paper: Paper }

export type PaperQuestionResult =
  | { kind: typeof PAPER_QUESTION_KIND.ok; paper: Paper }
  | { kind: typeof PAPER_QUESTION_KIND.notFound }
  | { kind: typeof PAPER_QUESTION_KIND.versionConflict; paper: Paper }
  | {
      kind: typeof PAPER_QUESTION_KIND.invalidTransition
      reason: 'invalid_transition' | 'question_text_required'
    }

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
  // 显式注入:vitest 的 esbuild 转译不生成装饰器参数元数据
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(UploadsRepository) private readonly uploads: UploadsRepository,
  ) {}

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

      const questionFields = input.questionText
        ? { questionStatus: 'thinking' as const, questionText: input.questionText }
        : input.hasQuestion
          ? // 标记疑问但未写问题文本:以正文截断充当问题文本,与迁移回填规则一致
            { questionStatus: 'thinking' as const, questionText: input.content.slice(0, 2_000) }
          : { questionStatus: 'none' as const, questionText: null }

      const [paper] = await tx
        .insert(papers)
        .values({
          userId,
          content: input.content,
          topicId: null,
          hasQuestion: questionFields.questionStatus !== 'none',
          isQuestionResolved: false,
          questionStatus: questionFields.questionStatus,
          questionText: questionFields.questionText,
          understandingText: input.understandingText ?? null,
        })
        .returning()
      if (input.assetUploadIds?.length) {
        // 同一事务内绑定已直传资产;任一会话不可用即回滚创建
        await this.uploads.attachToPaper(tx, userId, paper.id, input.assetUploadIds)
      }
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

      const [paper] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: PAPER_ORGANIZE_KIND.notFound }
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
          updatedAt: sql`now()`,
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

  async update(userId: string, input: UpdatePaperInput): Promise<PaperCommandResult> {
    return this.database.db.transaction(async (tx) => {
      const [paper] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (paper.content === input.content) {
        return { kind: PAPER_COMMAND_KIND.ok, paper }
      }
      if (paper.version !== input.version) {
        return { kind: PAPER_COMMAND_KIND.versionConflict, paper }
      }

      const [updated] = await tx
        .update(papers)
        .set({
          content: input.content,
          version: sql`${papers.version} + 1`,
          updatedAt: sql`now()`,
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
        return { kind: PAPER_COMMAND_KIND.ok, paper: updated }
      }

      const [latest] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .limit(1)
      if (!latest) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (latest.content === input.content) {
        return { kind: PAPER_COMMAND_KIND.ok, paper: latest }
      }
      return { kind: PAPER_COMMAND_KIND.versionConflict, paper: latest }
    })
  }

  async moveToInbox(userId: string, input: PaperCommandInput): Promise<PaperCommandResult> {
    return this.database.db.transaction(async (tx) => {
      const [paper] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (paper.topicId === null) {
        return { kind: PAPER_COMMAND_KIND.ok, paper }
      }
      if (paper.version !== input.version) {
        return { kind: PAPER_COMMAND_KIND.versionConflict, paper }
      }

      const [updated] = await tx
        .update(papers)
        .set({
          topicId: null,
          version: sql`${papers.version} + 1`,
          updatedAt: sql`now()`,
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
        return { kind: PAPER_COMMAND_KIND.ok, paper: updated }
      }

      const [latest] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .limit(1)
      if (!latest) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (latest.topicId === null) {
        return { kind: PAPER_COMMAND_KIND.ok, paper: latest }
      }
      return { kind: PAPER_COMMAND_KIND.versionConflict, paper: latest }
    })
  }

  async remove(userId: string, input: PaperCommandInput): Promise<PaperCommandResult> {
    return this.database.db.transaction(async (tx) => {
      const [paper] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id)))
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (paper.deletedAt) {
        return { kind: PAPER_COMMAND_KIND.ok, paper }
      }
      if (paper.version !== input.version) {
        return { kind: PAPER_COMMAND_KIND.versionConflict, paper }
      }

      const now = new Date()
      const [updated] = await tx
        .update(papers)
        .set({
          deletedAt: now,
          version: sql`${papers.version} + 1`,
          updatedAt: now,
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
        return { kind: PAPER_COMMAND_KIND.ok, paper: updated }
      }

      const [latest] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id)))
        .limit(1)
      if (!latest) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (latest.deletedAt) {
        return { kind: PAPER_COMMAND_KIND.ok, paper: latest }
      }
      return { kind: PAPER_COMMAND_KIND.versionConflict, paper: latest }
    })
  }

  async updateQuestion(
    userId: string,
    input: UpdatePaperQuestionInput,
  ): Promise<PaperQuestionResult> {
    return this.database.db.transaction(async (tx) => {
      const [paper] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: PAPER_QUESTION_KIND.notFound }
      }

      const result = planQuestionTransition({
        current: paper.questionStatus,
        command: { status: input.status, questionText: input.questionText },
        currentQuestionText: paper.questionText,
      })
      if (!result.ok) {
        return { kind: PAPER_QUESTION_KIND.invalidTransition, reason: result.reason }
      }
      const { plan } = result
      if (!plan.changed) {
        return { kind: PAPER_QUESTION_KIND.ok, paper }
      }
      if (paper.version !== input.version) {
        return { kind: PAPER_QUESTION_KIND.versionConflict, paper }
      }

      const [updated] = await tx
        .update(papers)
        .set({
          questionStatus: plan.questionStatus,
          questionText: plan.questionText,
          questionResolvedAt:
            plan.questionResolvedAt === 'now'
              ? new Date()
              : plan.questionResolvedAt === 'clear'
                ? null
                : paper.questionResolvedAt,
          hasQuestion: plan.hasQuestion,
          isQuestionResolved: plan.isQuestionResolved,
          version: sql`${papers.version} + 1`,
          updatedAt: sql`now()`,
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
        return { kind: PAPER_QUESTION_KIND.ok, paper: updated }
      }

      const [latest] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id), isNull(papers.deletedAt)))
        .limit(1)
      if (!latest) {
        return { kind: PAPER_QUESTION_KIND.notFound }
      }
      return { kind: PAPER_QUESTION_KIND.versionConflict, paper: latest }
    })
  }

  /** 恢复软删除纸页;与 remove 对称,未删除时幂等返回且不校验版本。 */
  async restore(userId: string, input: PaperCommandInput): Promise<PaperCommandResult> {
    return this.database.db.transaction(async (tx) => {
      const [paper] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id)))
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (!paper.deletedAt) {
        return { kind: PAPER_COMMAND_KIND.ok, paper }
      }
      if (paper.version !== input.version) {
        return { kind: PAPER_COMMAND_KIND.versionConflict, paper }
      }

      const [updated] = await tx
        .update(papers)
        .set({
          deletedAt: null,
          version: sql`${papers.version} + 1`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(papers.userId, userId),
            eq(papers.id, input.id),
            eq(papers.version, input.version),
            sql`${papers.deletedAt} is not null`,
          ),
        )
        .returning()
      if (updated) {
        return { kind: PAPER_COMMAND_KIND.ok, paper: updated }
      }

      const [latest] = await tx
        .select()
        .from(papers)
        .where(and(eq(papers.userId, userId), eq(papers.id, input.id)))
        .limit(1)
      if (!latest) {
        return { kind: PAPER_COMMAND_KIND.notFound }
      }
      if (!latest.deletedAt) {
        return { kind: PAPER_COMMAND_KIND.ok, paper: latest }
      }
      return { kind: PAPER_COMMAND_KIND.versionConflict, paper: latest }
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
    if (input.questionStatus === 'thinking') {
      conditions.push(eq(papers.questionStatus, 'thinking'))
    }
    if (input.questionStatus === 'resolved') {
      conditions.push(eq(papers.questionStatus, 'resolved'))
    }
    if (input.questionStatus === 'all') {
      conditions.push(ne(papers.questionStatus, 'none'))
    }
    if (input.cursor) {
      const cursor = decodeCursor(input.cursor)
      const createdAt = sql<Date>`date_trunc('milliseconds', ${papers.createdAt})`
      conditions.push(
        or(
          lt(createdAt, new Date(cursor.createdAt)),
          and(eq(createdAt, new Date(cursor.createdAt)), lt(papers.id, cursor.id)),
        )!,
      )
    }
    const createdAt = sql<Date>`date_trunc('milliseconds', ${papers.createdAt})`
    const rows = await this.database.db
      .select()
      .from(papers)
      .where(and(...conditions))
      .orderBy(desc(createdAt), desc(papers.id))
      .limit(input.limit + 1)
    const hasNextPage = rows.length > input.limit
    const items = rows.slice(0, input.limit)
    return {
      items,
      pageInfo: { hasNextPage, nextCursor: hasNextPage ? encodeCursor(items.at(-1)!) : null },
    }
  }
}
