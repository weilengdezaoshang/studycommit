import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { imageSize } from 'image-size'
import type {
  CompleteUploadOutput,
  CreateUploadInput,
  CreateUploadOutput,
} from '@studycommit/rpc-contracts/uploads'
import { isConstraint } from '../common/idempotency'
import {
  ASSET_READ_HEAD_BYTES,
  UPLOAD_ACCESS_TTL_SECONDS,
  UPLOAD_ERROR,
  UPLOAD_PUT_TTL_SECONDS,
  UPLOAD_SESSION_TTL_MS,
} from './uploads.constants'
import {
  PAPER_ASSET_UPLOAD_ID_INDEX,
  UploadsRepository,
  type PaperAsset,
} from './uploads.repository'
import { detectImageMime, StorageGatewayProvider, type StorageGateway } from './storage.gateway'

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

@Injectable()
export class UploadsService {
  constructor(
    // 显式注入:vitest 的 esbuild 转译不生成装饰器参数元数据
    @Inject(UploadsRepository) private readonly repository: UploadsRepository,
    @Inject(StorageGatewayProvider) private readonly storage: StorageGatewayProvider,
  ) {}

  async createUpload(userId: string, input: CreateUploadInput): Promise<CreateUploadOutput> {
    const gateway = this.requireGateway()
    const existing = await this.repository.findByUploadId(userId, input.uploadId)
    if (existing) {
      // 已取消或已软删的 uploadId 不复用,客户端应生成新的 uploadId
      if (
        !existing.deletedAt &&
        existing.status !== 'deleted' &&
        this.matchesSession(existing, input)
      ) {
        return this.toCreateOutput(gateway, existing)
      }
      throw new ConflictException(UPLOAD_ERROR.conflict)
    }
    const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_MS)
    try {
      const created = await this.repository.createSession(userId, input, {
        storageKey: buildStorageKey(userId, input.uploadId, input.mimeType, new Date()),
        expiresAt,
      })
      return this.toCreateOutput(gateway, created)
    } catch (error) {
      // 并发同 uploadId 创建:读取既有行,同参视为重放,异参视为冲突
      if (!isConstraint(error, PAPER_ASSET_UPLOAD_ID_INDEX)) {
        throw error
      }
      const replayed = await this.repository.findByUploadId(userId, input.uploadId)
      if (
        replayed &&
        !replayed.deletedAt &&
        replayed.status !== 'deleted' &&
        this.matchesSession(replayed, input)
      ) {
        return this.toCreateOutput(gateway, replayed)
      }
      throw new ConflictException(UPLOAD_ERROR.conflict)
    }
  }

  async completeUpload(userId: string, uploadId: string): Promise<CompleteUploadOutput> {
    const gateway = this.requireGateway()
    const asset = await this.repository.findByUploadId(userId, uploadId)
    if (!asset || asset.deletedAt) {
      throw new NotFoundException(UPLOAD_ERROR.notFound)
    }
    if (asset.status === 'uploaded' || asset.status === 'attached') {
      return this.toCompleteOutput(asset)
    }

    const stat = await gateway.stat(asset.storageKey)
    if (!stat) {
      throw new ConflictException(UPLOAD_ERROR.objectMissing)
    }
    if (stat.size !== asset.sizeBytes) {
      throw new ConflictException({
        ...UPLOAD_ERROR.sizeMismatch,
        details: { expected: asset.sizeBytes, actual: stat.size },
      })
    }
    const head = await gateway.readHead(asset.storageKey, ASSET_READ_HEAD_BYTES)
    const detected = detectImageMime(head)
    if (!detected || detected !== asset.mimeType) {
      throw new ConflictException(UPLOAD_ERROR.mimeMismatch)
    }
    let dimensions: { width: number; height: number }
    try {
      const parsed = imageSize(head)
      if (!parsed.width || !parsed.height) {
        throw new Error('missing dimensions')
      }
      dimensions = { width: parsed.width, height: parsed.height }
    } catch {
      throw new ConflictException(UPLOAD_ERROR.unreadable)
    }

    const updated = await this.repository.markUploaded(asset.id, dimensions)
    return this.toCompleteOutput(updated)
  }

  async accessAsset(userId: string, id: string) {
    const gateway = this.requireGateway()
    const asset = await this.repository.findById(userId, id)
    if (!asset || asset.deletedAt || (asset.status !== 'uploaded' && asset.status !== 'attached')) {
      throw new NotFoundException(UPLOAD_ERROR.notFound)
    }
    const signed = await gateway.presignGet(asset.storageKey, UPLOAD_ACCESS_TTL_SECONDS)
    return { assetId: asset.id, url: signed.url, expiresAt: signed.expiresAt.toISOString() }
  }

  async removeUpload(userId: string, uploadId: string) {
    const asset = await this.repository.findByUploadId(userId, uploadId)
    if (!asset) {
      throw new NotFoundException(UPLOAD_ERROR.notFound)
    }
    if (asset.status === 'attached') {
      throw new ConflictException(UPLOAD_ERROR.notCancellable)
    }
    if (asset.status !== 'deleted' && asset.deletedAt === null) {
      await this.requireGatewaySafe().delete(asset.storageKey)
    }
    await this.repository.markDeleted(asset.id)
    return { uploadId, deleted: true as const }
  }

  /** 清理任务:回收过期未完成会话的对象与记录,返回清理数量。 */
  async cleanupExpired(now: Date): Promise<number> {
    const gateway = this.storage.gateway
    if (!gateway) {
      return 0
    }
    const expired = await this.repository.listExpiredPending(now)
    for (const asset of expired) {
      try {
        await gateway.delete(asset.storageKey)
      } catch {
        // 对象可能已被直传端清理;仍要软删会话行,避免下次重复扫描
      }
      await this.repository.markDeleted(asset.id)
    }
    return expired.length
  }

  private requireGateway(): StorageGateway {
    if (!this.storage.gateway) {
      throw new ServiceUnavailableException(UPLOAD_ERROR.unavailable)
    }
    return this.storage.gateway
  }

  /** 取消路径里的对象删除:存储不可用时仍允许软删会话行。 */
  private requireGatewaySafe(): StorageGateway {
    if (!this.storage.gateway) {
      return {
        presignPut: async () => {
          throw new ServiceUnavailableException(UPLOAD_ERROR.unavailable)
        },
        presignGet: async () => {
          throw new ServiceUnavailableException(UPLOAD_ERROR.unavailable)
        },
        stat: async () => null,
        readHead: async () => Buffer.alloc(0),
        delete: async () => undefined,
      }
    }
    return this.storage.gateway
  }

  private matchesSession(asset: PaperAsset, input: CreateUploadInput): boolean {
    return (
      asset.kind === input.kind &&
      asset.mimeType === input.mimeType &&
      asset.sizeBytes === input.sizeBytes &&
      asset.sha256 === input.sha256
    )
  }

  private async toCreateOutput(
    gateway: StorageGateway,
    asset: PaperAsset,
  ): Promise<CreateUploadOutput> {
    const signed = await gateway.presignPut(
      asset.storageKey,
      asset.mimeType,
      UPLOAD_PUT_TTL_SECONDS,
    )
    return {
      uploadId: asset.uploadId,
      assetId: asset.id,
      kind: asset.kind,
      status: 'pending',
      uploadUrl: signed.url,
      headers: signed.headers,
      expiresAt: signed.expiresAt.toISOString(),
    }
  }

  private toCompleteOutput(asset: PaperAsset): CompleteUploadOutput {
    return {
      uploadId: asset.uploadId,
      assetId: asset.id,
      kind: asset.kind,
      status: 'uploaded',
      mimeType: asset.mimeType as CompleteUploadOutput['mimeType'],
      sizeBytes: asset.sizeBytes,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
    }
  }
}

export function buildStorageKey(
  userId: string,
  uploadId: string,
  mimeType: string,
  at: Date,
): string {
  const month = `${at.getUTCFullYear()}${String(at.getUTCMonth() + 1).padStart(2, '0')}`
  const ext = MIME_EXTENSIONS[mimeType] ?? 'bin'
  return `u/${userId}/${month}/${uploadId}.${ext}`
}
