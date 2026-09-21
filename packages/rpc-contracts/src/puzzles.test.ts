import { describe, expect, it } from 'vitest'
import { puzzleAlbumSchema, puzzlesContract } from './puzzles'

describe('puzzlesContract', () => {
  it('暴露画册选择和揭晓路由', () => {
    expect(puzzlesContract.album['~orpc'].route.path).toBe('/puzzles/album')
    expect(puzzlesContract.selectArtwork['~orpc'].route.path).toBe('/puzzles/selection')
    expect(puzzlesContract.reveal['~orpc'].route.path).toBe('/puzzles/rewards/{rewardId}/reveal')
  })

  it('拒绝越界的拼图碎片编号', () => {
    expect(() =>
      puzzleAlbumSchema.parse({
        selectedArtworkId: null,
        credit: 0,
        artworks: [],
        rewards: [
          {
            id: crypto.randomUUID(),
            artworkId: crypto.randomUUID(),
            pieceIndex: 12,
            earnedAt: new Date().toISOString(),
            revealedAt: null,
          },
        ],
      }),
    ).toThrow()
  })
})
