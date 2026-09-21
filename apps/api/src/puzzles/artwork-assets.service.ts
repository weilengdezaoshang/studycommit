import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { imageSize } from 'image-size'
import { randomUUID } from 'node:crypto'
import { DatabaseService } from '../database/database.service'
import { puzzleArtworkAssets, puzzleArtworks } from '../database/schema'
import { detectImageMime, StorageGatewayProvider } from '../uploads/storage.gateway'

@Injectable()
export class ArtworkAssetsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(StorageGatewayProvider) private readonly storage: StorageGatewayProvider,
  ) {}
  list() {
    return this.database.db
      .select({
        key: puzzleArtworkAssets.key,
        title: puzzleArtworkAssets.title,
        style: puzzleArtworkAssets.style,
        width: puzzleArtworkAssets.width,
        height: puzzleArtworkAssets.height,
      })
      .from(puzzleArtworkAssets)
      .orderBy(puzzleArtworkAssets.createdAt)
  }
  async prepare(input: { key: string; mimeType: string; size: number }) {
    if (
      await this.database.db.query.puzzleArtworkAssets.findFirst({
        where: eq(puzzleArtworkAssets.key, input.key),
      })
    ) {
throw new ConflictException('素材标识已存在')
}
    const gateway = this.storage.gateway
    if (!gateway) {
throw new ServiceUnavailableException('对象存储未配置')
}
    const ext = input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType.split('/')[1]
    const storageKey = `puzzle-artworks/${input.key}/${randomUUID()}.${ext}`
    const signed = await gateway.presignPut(storageKey, input.mimeType, 900)
    return { storageKey, uploadUrl: signed.url, headers: signed.headers }
  }
  async complete(input: {
    key: string
    title: string
    style: string
    storageKey: string
    mimeType: string
  }) {
    if (!input.storageKey.startsWith(`puzzle-artworks/${input.key}/`)) {
throw new BadRequestException('上传会话无效')
}
    const gateway = this.storage.gateway
    if (!gateway) {
throw new ServiceUnavailableException('对象存储未配置')
}
    const stat = await gateway.stat(input.storageKey)
    if (!stat || stat.size > 15_000_000) {
throw new BadRequestException('图片未上传或超过 15MB')
}
    const head = await gateway.readHead(input.storageKey, 65_536)
    if (detectImageMime(head) !== input.mimeType) {
throw new BadRequestException('图片格式与声明不一致')
}
    const dimensions = imageSize(head)
    const width = dimensions.width ?? 0,
      height = dimensions.height ?? 0
    if (width < 800 || height < 600 || Math.abs(width / height - 4 / 3) > 0.015) {
throw new BadRequestException('原画须为 4:3，且不小于 800×600')
}
    const [asset] = await this.database.db
      .insert(puzzleArtworkAssets)
      .values({ ...input, width, height })
      .returning()
    return { key: asset.key, title: asset.title, style: asset.style, width, height }
  }
  async remove(key: string) {
    const used = await this.database.db.query.puzzleArtworks.findFirst({
      where: eq(puzzleArtworks.assetKey, key),
    })
    if (used) {
throw new ConflictException('素材已被画作使用')
}
    const [asset] = await this.database.db
      .delete(puzzleArtworkAssets)
      .where(eq(puzzleArtworkAssets.key, key))
      .returning()
    if (!asset) {
throw new NotFoundException('素材不存在')
}
    if (asset.storageKey) {
await this.storage.gateway?.delete(asset.storageKey)
}
    return { deleted: true }
  }
}
