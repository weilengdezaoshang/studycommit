import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { CreateUploadInput } from '@studycommit/rpc-contracts/uploads'
import { DatabaseService } from '../database/database.service'
import * as schema from '../database/schema'
import { paperAssets } from '../database/schema'
import { UPLOAD_ERROR } from './uploads.constants'

export type PaperAsset = typeof paperAssets.$inferSelect

/** drizzle 事务句柄:papers 创建绑定资产时复用同一事务。 */
export type PaperAssetsTx = Parameters<
  Parameters<NodePgDatabase<typeof schema>['transaction']>[0]
>[0]

export const PAPER_ASSET_UPLOAD_ID_INDEX = 'paper_assets_user_upload_id_idx'

@Injectable()
export class UploadsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findByUploadId(userId: string, uploadId: string): Promise<PaperAsset | null> {
    const [row] = await this.database.db
      .select()
      .from(paperAssets)
      .where(and(eq(paperAssets.userId, userId), eq(paperAssets.uploadId, uploadId)))
      .limit(1)
    return row ?? null
  }

  async findById(userId: string, id: string): Promise<PaperAsset | null> {
    const [row] = await this.database.db
      .select()
      .from(paperAssets)
      .where(and(eq(paperAssets.userId, userId), eq(paperAssets.id, id)))
      .limit(1)
    return row ?? null
  }

  async createSession(
    userId: string,
    input: CreateUploadInput,
    storage: { storageKey: string; expiresAt: Date },
  ): Promise<PaperAsset> {
    const [row] = await this.database.db
      .insert(paperAssets)
      .values({
        userId,
        uploadId: input.uploadId,
        kind: input.kind,
        status: 'pending',
        storageKey: storage.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
        expiresAt: storage.expiresAt,
      })
      .returning()
    return row
  }

  async markUploaded(
    assetId: string,
    dimensions: { width: number; height: number },
  ): Promise<PaperAsset> {
    const [row] = await this.database.db
      .update(paperAssets)
      .set({
        status: 'uploaded',
        width: dimensions.width,
        height: dimensions.height,
        updatedAt: new Date(),
      })
      .where(eq(paperAssets.id, assetId))
      .returning()
    return row
  }

  async markDeleted(assetId: string): Promise<void> {
    await this.database.db
      .update(paperAssets)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(paperAssets.id, assetId))
  }

  async listExpiredPending(now: Date): Promise<PaperAsset[]> {
    return this.database.db
      .select()
      .from(paperAssets)
      .where(and(eq(paperAssets.status, 'pending'), lt(paperAssets.expiresAt, now)))
      .limit(200)
  }

  /**
   * papers 创建时在同一事务内绑定资产:必须归属本人且已 uploaded,
   * 否则抛错回滚整个创建事务。
   */
  async attachToPaper(
    tx: PaperAssetsTx,
    userId: string,
    paperId: string,
    uploadIds: string[],
  ): Promise<void> {
    const rows = await tx
      .select()
      .from(paperAssets)
      .where(
        and(
          eq(paperAssets.userId, userId),
          inArray(paperAssets.uploadId, uploadIds),
          isNull(paperAssets.deletedAt),
        ),
      )
      .for('update')

    const rowsByUploadId = new Map(rows.map((row) => [row.uploadId, row]))
    const notReady = uploadIds.filter((uploadId) => {
      const row = rowsByUploadId.get(uploadId)
      return !row || row.status !== 'uploaded'
    })
    if (notReady.length > 0) {
      // 抛错回滚整个 papers 创建事务;幂等记录随事务一并回滚,客户端可修正后重试
      throw new BadRequestException({
        ...UPLOAD_ERROR.notAvailable,
        details: { uploadIds: notReady },
      })
    }

    await tx
      .update(paperAssets)
      .set({ paperId, status: 'attached', updatedAt: new Date() })
      .where(
        inArray(
          paperAssets.id,
          uploadIds.map((uploadId) => rowsByUploadId.get(uploadId)!.id),
        ),
      )
  }
}
