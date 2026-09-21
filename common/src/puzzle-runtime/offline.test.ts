import { describe, expect, it, vi } from 'vitest'
import { createOfflinePuzzleApi } from './offline'

const artwork = {
  id: '71000000-0000-4000-8000-000000000001',
  slug: 'spring',
  title: '春日',
  description: '',
  assetKey: 'spring',
  version: 1,
  pieceCount: 12 as const,
  status: 'published' as const,
  collectedCount: 0,
  completedAt: null,
  featured: false,
}
const album = {
  selectedArtworkId: artwork.id,
  featuredArtworkId: null,
  credit: 0,
  artworks: [artwork],
  rewards: [],
}

describe('createOfflinePuzzleApi', () => {
  it('断网时返回缓存并在联网后清空幂等队列', async () => {
    const values = new Map<string, string>()
    const storage = {
      get: async (key: string) => values.get(key) ?? null,
      set: async (key: string, value: string) => {
        values.set(key, value)
      },
    }
    const remote = {
      album: vi
        .fn()
        .mockResolvedValueOnce(album)
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(album),
      selectArtwork: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(album),
      reveal: vi.fn(),
      featureArtwork: vi.fn(),
    }
    const api = createOfflinePuzzleApi({ account: 'u1', remote, storage, createId: () => 'op-1' })
    await api.album()
    await expect(api.selectArtwork(artwork.id)).resolves.toMatchObject({
      selectedArtworkId: artwork.id,
    })
    await expect(api.album()).resolves.toMatchObject({ selectedArtworkId: artwork.id })
    expect(remote.selectArtwork).toHaveBeenCalledTimes(2)
  })
})
