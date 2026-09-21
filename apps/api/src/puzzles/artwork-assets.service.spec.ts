import { BadRequestException, ConflictException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { ArtworkAssetsService } from './artwork-assets.service'

function service(options?: { used?: boolean; head?: Buffer }) {
  const query = {
    puzzleArtworkAssets: { findFirst: vi.fn().mockResolvedValue(null) },
    puzzleArtworks: { findFirst: vi.fn().mockResolvedValue(options?.used ? { id: 'used' } : null) },
  }
  const database = { db: { query } }
  const gateway = {
    stat: vi.fn().mockResolvedValue({ size: 100, etag: null }),
    readHead: vi.fn().mockResolvedValue(options?.head ?? Buffer.from('not-an-image')),
    delete: vi.fn(),
    presignPut: vi.fn(),
    presignGet: vi.fn(),
    read: vi.fn(),
  }
  return new ArtworkAssetsService(database as never, { gateway } as never)
}

describe('ArtworkAssetsService', () => {
  it('拒绝声明格式与实际内容不一致的图片', async () => {
    await expect(
      service().complete({
        key: 'gentle-view',
        title: '温柔风景',
        style: '水彩',
        storageKey: 'puzzle-artworks/gentle-view/file.png',
        mimeType: 'image/png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('禁止删除已经被画作使用的素材', async () => {
    await expect(service({ used: true }).remove('gentle-view')).rejects.toBeInstanceOf(
      ConflictException,
    )
  })
})
