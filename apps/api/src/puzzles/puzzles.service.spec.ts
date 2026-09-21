import { describe, expect, it, vi } from 'vitest'
import { PuzzlesService } from './puzzles.service'

const USER_ID = '10000000-0000-4000-8000-000000000001'
const ARTWORK_ID = '71000000-0000-4000-8000-000000000001'
const REWARD_ID = '72000000-0000-4000-8000-000000000001'

describe('PuzzlesService', () => {
  it('返回当前画作及待揭晓奖励', async () => {
    const repository = {
      album: vi.fn().mockResolvedValue({
        state: { selectedArtworkId: ARTWORK_ID, featuredArtworkId: null, credit: 2 },
        artworks: [
          {
            id: ARTWORK_ID,
            slug: 'spring-rabbit',
            title: '春日来信',
            description: '',
            assetKey: 'spring-rabbit',
            version: 1,
            pieceCount: 12,
            status: 'published',
          },
        ],
        rewards: [
          {
            id: REWARD_ID,
            artworkId: ARTWORK_ID,
            pieceIndex: 4,
            earnedAt: new Date('2026-09-20T01:00:00Z'),
            revealedAt: null,
          },
        ],
        completions: [],
      }),
    }
    const album = await new PuzzlesService(repository as never).album(USER_ID)
    expect(album).toMatchObject({
      selectedArtworkId: ARTWORK_ID,
      credit: 2,
      rewards: [{ pieceIndex: 4, revealedAt: null }],
    })
  })

  it('重复确认揭晓时返回同一奖励', async () => {
    const reward = {
      id: REWARD_ID,
      artworkId: ARTWORK_ID,
      pieceIndex: 2,
      earnedAt: new Date(),
      revealedAt: new Date(),
    }
    const repository = { reveal: vi.fn().mockResolvedValue(reward) }
    const service = new PuzzlesService(repository as never)
    await expect(service.reveal(USER_ID, REWARD_ID)).resolves.toMatchObject({
      id: REWARD_ID,
      pieceIndex: 2,
    })
    await expect(service.reveal(USER_ID, REWARD_ID)).resolves.toMatchObject({
      id: REWARD_ID,
      pieceIndex: 2,
    })
  })

  it('只允许把已经完成的画作挂到首页', async () => {
    const repository = {
      featureArtwork: vi.fn().mockResolvedValue(false),
      album: vi.fn(),
    }
    await expect(
      new PuzzlesService(repository as never).featureArtwork(USER_ID, ARTWORK_ID),
    ).rejects.toThrow('只能展示已完成的画作')
  })

  it('挂到首页后返回更新后的画册', async () => {
    const repository = {
      featureArtwork: vi.fn().mockResolvedValue(true),
      album: vi.fn().mockResolvedValue({
        state: { selectedArtworkId: null, featuredArtworkId: ARTWORK_ID, credit: 0 },
        artworks: [],
        rewards: [],
        completions: [],
      }),
    }
    await expect(
      new PuzzlesService(repository as never).featureArtwork(USER_ID, ARTWORK_ID),
    ).resolves.toMatchObject({ featuredArtworkId: ARTWORK_ID })
  })
})
