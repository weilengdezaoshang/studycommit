import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { PuzzleAssetsController } from './puzzle-assets.controller'

describe('PuzzleAssetsController', () => {
  it('同源输出原画正文而不是 302 到对象存储', async () => {
    const body = Buffer.from('png')
    const send = vi.fn().mockReturnThis()
    const header = vi.fn().mockReturnThis()
    const controller = new PuzzleAssetsController(
      {
        db: {
          query: {
            puzzleArtworkAssets: {
              findFirst: vi.fn().mockResolvedValue({
                key: 'spring-rabbit',
                storageKey: 'puzzle-artworks/spring-rabbit/file.png',
                mimeType: 'image/png',
              }),
            },
          },
        },
      } as never,
      { gateway: { read: vi.fn().mockResolvedValue({ body, contentType: 'image/png' }) } } as never,
    )
    await controller.asset('spring-rabbit', { header, send } as never)
    expect(header).toHaveBeenCalledWith('content-type', 'image/png')
    expect(send).toHaveBeenCalledWith(body)
  })

  it('对象不存在时返回 404', async () => {
    const controller = new PuzzleAssetsController(
      {
        db: {
          query: {
            puzzleArtworkAssets: {
              findFirst: vi.fn().mockResolvedValue({
                key: 'missing',
                storageKey: 'puzzle-artworks/missing/file.png',
                mimeType: 'image/png',
              }),
            },
          },
        },
      } as never,
      { gateway: { read: vi.fn().mockResolvedValue(null) } } as never,
    )
    await expect(
      controller.asset('missing', { header: vi.fn(), send: vi.fn() } as never),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
