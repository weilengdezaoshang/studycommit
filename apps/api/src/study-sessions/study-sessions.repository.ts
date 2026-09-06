import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import type { NodePgTransaction } from 'drizzle-orm/node-postgres'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import * as schema from '../database/schema'
import {
  idempotencyRecords,
  learningLogs,
  paperAssets,
  paperFragments,
  papers,
  studySessions,
  topics,
} from '../database/schema'
import {
  SESSION_COMPLETION_SOURCE,
  SESSION_KIND,
  SESSION_RESOURCE_TYPE,
  SESSION_STATUS,
} from './study-session.constants'
import type {
  CompletePaperInput,
  CreateSessionFragmentInput,
  CreateStudySessionInput,
  UpdateSessionFragmentInput,
} from './study-session.schemas'
import { TOPIC_STATUS } from '../topics/topic.constants'

export type StudySession = typeof studySessions.$inferSelect
export type PaperFragment = typeof paperFragments.$inferSelect
export type Paper = typeof papers.$inferSelect
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
  | { kind: typeof SESSION_KIND.topicRequired }

export type CompletePaperResult =
  | {
      kind: typeof SESSION_KIND.ok
      session: StudySession
      paper: Paper
      nextPaper: Paper | null
      replayed: boolean
    }
  | { kind: typeof SESSION_KIND.missing }
  | { kind: typeof SESSION_KIND.versionConflict; session: StudySession }
  | { kind: typeof SESSION_KIND.idempotencyConflict }
  | { kind: typeof SESSION_KIND.sessionPaperMissing }
  | { kind: typeof SESSION_KIND.sessionCompleted }
  | { kind: typeof SESSION_KIND.paperMissing }
  | { kind: typeof SESSION_KIND.paperAlreadyExists }

export type FragmentCommandResult =
  | { kind: typeof SESSION_KIND.ok; fragment: PaperFragment; replayed: boolean }
  | { kind: typeof SESSION_KIND.missing }
  | { kind: typeof SESSION_KIND.sessionPaperMissing }
  | { kind: typeof SESSION_KIND.sessionCompleted }
  | { kind: typeof SESSION_KIND.idempotencyConflict }
  | { kind: typeof SESSION_KIND.fragmentMissing }
  | {
      kind: typeof SESSION_KIND.fragmentVersionConflict
      fragment: PaperFragment
    }
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
      const paperSummary = session?.paperId
        ? await this.findPaperSummary(tx, userId, session.paperId)
        : null
      return { session: session ?? null, serverNow, paper: paperSummary }
    })
  }

  /** 活动恢复用纸页摘要:问题文本、当前理解与已存片段数。 */
  private async findPaperSummary(tx: Transaction, userId: string, paperId: string) {
    const [paper] = await tx
      .select({
        id: papers.id,
        questionText: papers.questionText,
        understandingText: papers.understandingText,
      })
      .from(papers)
      .where(and(eq(papers.userId, userId), eq(papers.id, paperId), isNull(papers.deletedAt)))
      .limit(1)
    if (!paper) {
      return null
    }
    const [{ count: fragmentCount }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(paperFragments)
      .where(and(eq(paperFragments.userId, userId), eq(paperFragments.paperId, paperId)))
    return { ...paper, fragmentCount: Number(fragmentCount) }
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
    | { kind: typeof SESSION_KIND.paperMissing }
    | { kind: typeof SESSION_KIND.paperAlreadyExists }
    | { kind: typeof SESSION_KIND.uploadInvalid }
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

      // 三选一的起步来源:主题路径 / 既有问题继续 / 截图学习新建纸页
      // (引用校验先行,active 检查紧随其后,避免 409 时留下半建状态)
      let sessionTopicId: string | null = null
      let sessionPaperId: string | null = null
      let source: 'manual_topic' | 'desktop_capture' | 'desktop_existing_question' = 'manual_topic'
      if (input.topicId) {
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
        sessionTopicId = input.topicId
      } else if (input.paperId) {
        const [paper] = await tx
          .select({ id: papers.id })
          .from(papers)
          .where(
            and(eq(papers.userId, userId), eq(papers.id, input.paperId), isNull(papers.deletedAt)),
          )
          .for('share')
          .limit(1)
        if (!paper) {
          return { kind: SESSION_KIND.paperMissing }
        }
        const [active] = await tx
          .select()
          .from(studySessions)
          .where(and(eq(studySessions.userId, userId), activeCondition))
          .limit(1)
        if (active) {
          return { kind: SESSION_KIND.activeExists, session: active }
        }
        sessionPaperId = input.paperId
        source = 'desktop_existing_question'
      } else if (input.draftPaper) {
        const [active] = await tx
          .select()
          .from(studySessions)
          .where(and(eq(studySessions.userId, userId), activeCondition))
          .limit(1)
        if (active) {
          return { kind: SESSION_KIND.activeExists, session: active }
        }
        const draft = input.draftPaper
        let screenshotAssetId: string | null = null
        if (draft.screenshotUploadId) {
          const [asset] = await tx
            .select({ id: paperAssets.id })
            .from(paperAssets)
            .where(
              and(
                eq(paperAssets.userId, userId),
                eq(paperAssets.uploadId, draft.screenshotUploadId),
                eq(paperAssets.kind, 'source_screenshot'),
                eq(paperAssets.status, 'uploaded'),
              ),
            )
            .for('share')
            .limit(1)
          if (!asset) {
            return { kind: SESSION_KIND.uploadInvalid }
          }
          screenshotAssetId = asset.id
        }
        const [createdPaper] = await tx
          .insert(papers)
          .values({
            id: draft.paperId,
            userId,
            content: draft.questionText,
            questionText: draft.questionText,
            questionStatus: 'thinking',
            hasQuestion: true,
            isQuestionResolved: false,
            source: 'desktop_capture',
          })
          .onConflictDoNothing({ target: papers.id })
          .returning()
        if (!createdPaper) {
          return { kind: SESSION_KIND.paperAlreadyExists }
        }
        if (screenshotAssetId) {
          await tx
            .update(paperAssets)
            .set({
              status: 'attached',
              paperId: createdPaper.id,
              updatedAt: new Date(),
              ...(draft.ocrText !== undefined ? { ocrText: draft.ocrText } : {}),
            })
            .where(eq(paperAssets.id, screenshotAssetId))
        }
        sessionPaperId = createdPaper.id
        source = 'desktop_capture'
      }

      const [session] = await tx
        .insert(studySessions)
        .values({
          userId,
          topicId: sessionTopicId,
          paperId: sessionPaperId,
          source,
          goal: input.goal ?? null,
        })
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
      if (!session.topicId) {
        // 学习记录表 topic_id 非空:桌面截图会话没有主题,必须走 complete-paper 收尾
        return { kind: SESSION_KIND.topicRequired }
      }
      const topicId: string = session.topicId

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
          topicId,
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
        .where(eq(topics.id, topicId))
      await this.saveCompleteIdempotency(tx, userId, updated, learningLog, idempotency)
      return { kind: SESSION_KIND.ok, session: updated, learningLog, replayed: false }
    })
  }

  /** 纸页收尾(BE-309):完成会话并回写理解文本,可选创建“下一个问题”纸页。 */
  async completePaper(
    userId: string,
    id: string,
    input: CompletePaperInput,
    idempotency: { key: string; hash: string },
  ): Promise<CompletePaperResult> {
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

      const replay = await this.findCompletePaperReplay(tx, userId, idempotency)
      if (replay) {
        return replay
      }
      if (session.status === SESSION_STATUS.completed) {
        return { kind: SESSION_KIND.sessionCompleted }
      }
      if (session.version !== input.version) {
        return { kind: SESSION_KIND.versionConflict, session }
      }
      if (!session.paperId) {
        return { kind: SESSION_KIND.sessionPaperMissing }
      }

      const [paper] = await tx
        .select()
        .from(papers)
        .where(
          and(eq(papers.userId, userId), eq(papers.id, session.paperId), isNull(papers.deletedAt)),
        )
        .for('update')
        .limit(1)
      if (!paper) {
        return { kind: SESSION_KIND.paperMissing }
      }

      let totalPausedSeconds = session.totalPausedSeconds
      if (session.status === SESSION_STATUS.paused) {
        const nowForPause = await this.transactionNow(tx)
        totalPausedSeconds += Math.max(
          0,
          Math.floor((nowForPause.getTime() - session.pausedAt!.getTime()) / 1000),
        )
      }
      const now = await this.transactionNow(tx)
      const durationSeconds = Math.max(
        0,
        Math.floor((now.getTime() - session.startedAt.getTime()) / 1000) - totalPausedSeconds,
      )
      const [updatedSession] = await tx
        .update(studySessions)
        .set({
          status: SESSION_STATUS.completed,
          pausedAt: null,
          totalPausedSeconds,
          completedAt: now,
          durationSeconds,
          completionSource: SESSION_COMPLETION_SOURCE.online,
          version: sql`${studySessions.version} + 1`,
          updatedAt: now,
        })
        .where(eq(studySessions.id, id))
        .returning()

      // 理解文本写回当前纸页;问题状态保持(thinking 不变,resolved 不重开)
      const [updatedPaper] = await tx
        .update(papers)
        .set({
          understandingText: input.understandingText,
          version: sql`${papers.version} + 1`,
          updatedAt: now,
        })
        .where(eq(papers.id, paper.id))
        .returning()

      let nextPaper: Paper | null = null
      if (input.nextQuestionText && input.nextPaperId) {
        const [created] = await tx
          .insert(papers)
          .values({
            id: input.nextPaperId,
            userId,
            content: input.nextQuestionText,
            questionText: input.nextQuestionText,
            questionStatus: 'thinking',
            hasQuestion: true,
            isQuestionResolved: false,
            source: 'desktop_session',
            sourceSessionId: session.id,
          })
          .onConflictDoNothing({ target: papers.id })
          .returning()
        if (!created) {
          return { kind: SESSION_KIND.paperAlreadyExists }
        }
        nextPaper = created
      }

      await tx.insert(idempotencyRecords).values({
        userId,
        key: idempotency.key,
        requestHash: idempotency.hash,
        resourceType: SESSION_RESOURCE_TYPE,
        resourceId: session.id,
        response: { session: updatedSession, paper: updatedPaper, nextPaper },
      })
      return {
        kind: SESSION_KIND.ok,
        session: updatedSession,
        paper: updatedPaper,
        nextPaper,
        replayed: false,
      }
    })
  }

  /** 记下一条学习片段:会话须进行中且关联纸页;fragmentId 兼作幂等锚点。 */
  async createFragment(
    userId: string,
    id: string,
    input: CreateSessionFragmentInput,
    idempotency: { key: string; hash: string },
  ): Promise<FragmentCommandResult | { kind: typeof SESSION_KIND.paperAlreadyExists }> {
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
      if (session.status === SESSION_STATUS.completed) {
        return { kind: SESSION_KIND.sessionCompleted }
      }
      if (!session.paperId) {
        return { kind: SESSION_KIND.sessionPaperMissing }
      }

      const replay = await this.findFragmentReplay(tx, userId, idempotency)
      if (replay) {
        return replay
      }

      // 同一 fragmentId 重试:同会话返回已有片段(幂等),跨会话视为键冲突
      const [existing] = await tx
        .select()
        .from(paperFragments)
        .where(and(eq(paperFragments.userId, userId), eq(paperFragments.id, input.fragmentId)))
        .limit(1)
      if (existing) {
        if (existing.sessionId !== session.id) {
          return { kind: SESSION_KIND.idempotencyConflict }
        }
        await this.saveFragmentIdempotency(tx, userId, existing, idempotency)
        return { kind: SESSION_KIND.ok, fragment: existing, replayed: true }
      }

      const position =
        input.position ?? (await this.nextFragmentPosition(tx, userId, session.paperId))
      const [fragment] = await tx
        .insert(paperFragments)
        .values({
          id: input.fragmentId,
          userId,
          paperId: session.paperId,
          sessionId: session.id,
          content: input.content,
          position,
        })
        .onConflictDoNothing({ target: paperFragments.id })
        .returning()
      if (!fragment) {
        // 并发下同 fragmentId:回读已有行
        const [raced] = await tx
          .select()
          .from(paperFragments)
          .where(and(eq(paperFragments.userId, userId), eq(paperFragments.id, input.fragmentId)))
          .limit(1)
        if (!raced || raced.sessionId !== session.id) {
          return { kind: SESSION_KIND.idempotencyConflict }
        }
        return { kind: SESSION_KIND.ok, fragment: raced, replayed: true }
      }
      await this.saveFragmentIdempotency(tx, userId, fragment, idempotency)
      return { kind: SESSION_KIND.ok, fragment, replayed: false }
    })
  }

  /** 修改学习片段:乐观锁;content 与 position 至少一项。 */
  async updateFragment(
    userId: string,
    id: string,
    fragmentId: string,
    input: UpdateSessionFragmentInput,
  ): Promise<FragmentCommandResult> {
    return this.database.db.transaction(async (tx) => {
      const [fragment] = await tx
        .select()
        .from(paperFragments)
        .where(and(eq(paperFragments.userId, userId), eq(paperFragments.id, fragmentId)))
        .for('update')
        .limit(1)
      if (!fragment || fragment.sessionId !== id) {
        return { kind: SESSION_KIND.fragmentMissing }
      }
      if (fragment.version !== input.version) {
        return { kind: SESSION_KIND.fragmentVersionConflict, fragment }
      }
      const now = new Date()
      const [updated] = await tx
        .update(paperFragments)
        .set({
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.position !== undefined ? { position: input.position } : {}),
          version: sql`${paperFragments.version} + 1`,
          updatedAt: now,
        })
        .where(eq(paperFragments.id, fragmentId))
        .returning()
      return { kind: SESSION_KIND.ok, fragment: updated, replayed: false }
    })
  }

  private async nextFragmentPosition(tx: Transaction, userId: string, paperId: string) {
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${paperFragments.position}), -1) + 1` })
      .from(paperFragments)
      .where(and(eq(paperFragments.userId, userId), eq(paperFragments.paperId, paperId)))
    return Number(next)
  }

  private async findFragmentReplay(
    tx: Transaction,
    userId: string,
    idempotency: { key: string; hash: string },
  ): Promise<FragmentCommandResult | null> {
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
    return { kind: SESSION_KIND.ok, fragment: record.response as PaperFragment, replayed: true }
  }

  private async saveFragmentIdempotency(
    tx: Transaction,
    userId: string,
    fragment: PaperFragment,
    idempotency: { key: string; hash: string },
  ) {
    await tx.insert(idempotencyRecords).values({
      userId,
      key: idempotency.key,
      requestHash: idempotency.hash,
      resourceType: SESSION_RESOURCE_TYPE,
      resourceId: fragment.sessionId,
      response: fragment,
    })
  }

  private async findCompletePaperReplay(
    tx: Transaction,
    userId: string,
    idempotency: { key: string; hash: string },
  ): Promise<CompletePaperResult | null> {
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
    if (!!stored && typeof stored === 'object' && 'session' in stored && 'paper' in stored) {
      const replayed = stored as { session: StudySession; paper: Paper; nextPaper: Paper | null }
      return {
        kind: SESSION_KIND.ok,
        session: replayed.session,
        paper: replayed.paper,
        nextPaper: replayed.nextPaper ?? null,
        replayed: true,
      }
    }
    return null
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
