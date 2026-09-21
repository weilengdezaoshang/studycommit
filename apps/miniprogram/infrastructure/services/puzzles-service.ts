import {
  puzzleAlbumSchema,
  puzzleRewardSchema,
  type PuzzleAlbum,
  type PuzzleReward,
} from '@studycommit/rpc-contracts/puzzles'
import type { MiniprogramTransport } from '../transport/transport.types'

export type PuzzlesService = {
  album(): Promise<PuzzleAlbum>
  selectArtwork(artworkId: string): Promise<PuzzleAlbum>
  reveal(rewardId: string): Promise<PuzzleReward>
  featureArtwork(artworkId: string): Promise<PuzzleAlbum>
}

export function createPuzzlesService(transport: MiniprogramTransport): PuzzlesService {
  return {
    album: () =>
      transport.call('puzzles.album', {}).then((value) => puzzleAlbumSchema.parse(value)),
    selectArtwork: (artworkId) =>
      transport
        .call('puzzles.selectArtwork', { artworkId })
        .then((value) => puzzleAlbumSchema.parse(value)),
    reveal: (rewardId) =>
      transport
        .call('puzzles.reveal', { rewardId })
        .then((value) => puzzleRewardSchema.parse(value)),
    featureArtwork: (artworkId) =>
      transport
        .call('puzzles.featureArtwork', { artworkId })
        .then((value) => puzzleAlbumSchema.parse(value)),
  }
}
