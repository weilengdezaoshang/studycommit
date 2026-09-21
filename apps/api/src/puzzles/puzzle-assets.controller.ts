import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { DatabaseService } from '../database/database.service'
import { puzzleArtworkAssets } from '../database/schema'
import { eq } from 'drizzle-orm'
import { StorageGatewayProvider } from '../uploads/storage.gateway'

@Controller('puzzles/assets')
export class PuzzleAssetsController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(StorageGatewayProvider) private readonly storage: StorageGatewayProvider,
  ) {}
  @Get(':key')
  async asset(@Param('key') key: string, @Res() reply: FastifyReply) {
    const asset = await this.database.db.query.puzzleArtworkAssets.findFirst({
      where: eq(puzzleArtworkAssets.key, key),
    })
    if (!asset) {
throw new NotFoundException('原画不存在')
}
    const gateway = this.storage.gateway
    if (!asset.storageKey || !gateway) {
throw new NotFoundException('原画存储不可用')
}
    const object = await gateway.read(asset.storageKey)
    if (!object) {
throw new NotFoundException('原画存储不可用')
}
    return reply
      .header('content-type', asset.mimeType || object.contentType || 'application/octet-stream')
      .header('cache-control', 'public, max-age=86400')
      .header('x-content-type-options', 'nosniff')
      .send(object.body)
  }
}
