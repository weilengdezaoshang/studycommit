import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { asc, eq, sql } from 'drizzle-orm'
import type { ArtworkDraft } from '@studycommit/rpc-contracts/puzzles'
import { artworkDraftSchema } from '@studycommit/rpc-contracts/puzzles'
import { DatabaseService } from '../database/database.service'
import {
  adminAuditLogs,
  puzzleArtworkAssets,
  puzzleArtworks,
  puzzleRewards,
} from '../database/schema'

@Injectable()
export class AdminArtworksService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async list() {
    const rows = await this.database.db
      .select({
        artwork: puzzleArtworks,
        hasRewards: sql<boolean>`exists(select 1 from ${puzzleRewards} where ${puzzleRewards.artworkId} = ${puzzleArtworks.id})`,
      })
      .from(puzzleArtworks)
      .orderBy(asc(puzzleArtworks.sortOrder), asc(puzzleArtworks.id))
    return { items: rows.map(({ artwork, hasRewards }) => this.dto(artwork, hasRewards)) }
  }
  private dto(row: typeof puzzleArtworks.$inferSelect, hasRewards: boolean) {
    return { ...row, pieceCount: 12 as const, updatedAt: row.updatedAt.toISOString(), hasRewards }
  }
  async write(
    actorUserId: string,
    input: {
      id?: string
      expectedVersion?: number
      draft?: ArtworkDraft
      status?: 'published' | 'retired'
      reason: string
    },
  ) {
    if (input.draft) {
input = { ...input, draft: artworkDraftSchema.parse(input.draft) }
}
    if (
      input.draft &&
      !(await this.database.db.query.puzzleArtworkAssets.findFirst({
        where: eq(puzzleArtworkAssets.key, input.draft.assetKey),
      }))
    ) {
throw new BadRequestException('请从素材库选择原画')
}
    return this.database.db.transaction(async (tx) => {
      const before = input.id
        ? (
            await tx
              .select()
              .from(puzzleArtworks)
              .where(eq(puzzleArtworks.id, input.id))
              .for('update')
          )[0]
        : null
      if (input.id && !before) {
throw new NotFoundException('画作不存在')
}
      if (before && before.version !== input.expectedVersion) {
throw new ConflictException('画作已被其他人更新，请刷新后重试')
}
      const rewarded = before
        ? (
            await tx
              .select({ id: puzzleRewards.id })
              .from(puzzleRewards)
              .where(eq(puzzleRewards.artworkId, before.id))
              .limit(1)
          ).length > 0
        : false
      if (before && input.draft && before.status === 'published') {
throw new BadRequestException('请先下架画作再编辑')
}
      if (before && input.draft && rewarded && before.assetKey !== input.draft.assetKey) {
throw new BadRequestException('已发放碎片的画作不能替换原图，请新建画作')
}
      if (input.status && before?.status === input.status) {
throw new ConflictException('画作已经处于该状态，请刷新')
}
      if (input.status === 'retired' && before?.status !== 'published') {
throw new BadRequestException('只有已发布画作可以下架')
}
      if (input.status === 'published') {
        if (!before?.title.trim() || !before.description.trim()) {
throw new BadRequestException('发布前请补齐画作名称和简介')
}
        const [asset] = await tx
          .select()
          .from(puzzleArtworkAssets)
          .where(eq(puzzleArtworkAssets.key, before.assetKey))
          .limit(1)
        if (!asset?.storageKey || asset.width * 3 !== asset.height * 4) {
throw new BadRequestException('发布前请完成 4:3 原画上传和拼图预览')
}
      }
      const [row] = before
        ? await tx
            .update(puzzleArtworks)
            .set({
              ...input.draft,
              ...(input.status ? { status: input.status } : {}),
              version: before.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(puzzleArtworks.id, before.id))
            .returning()
        : await tx
            .insert(puzzleArtworks)
            .values({ ...input.draft!, slug: crypto.randomUUID(), status: 'draft' })
            .returning()
      await tx.insert(adminAuditLogs).values({
        actorUserId,
        action: input.status ? `artwork.${input.status}` : 'artwork.save',
        targetType: 'artwork',
        targetId: row.id,
        beforeSnapshot: before,
        afterSnapshot: row,
        reason: input.reason,
      })
      return this.dto(row, rewarded)
    })
  }
}
