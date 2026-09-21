import {
  revealPuzzleRewardInputSchema,
  featurePuzzleArtworkInputSchema,
  selectPuzzleArtworkInputSchema,
} from '@studycommit/rpc-contracts/puzzles'
import type { PuzzleApi } from '@studycommit/common/ports'
import { puzzleIpcChannels } from '../../shared/puzzle-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export function registerPuzzleIpc(host: IpcHost, puzzles?: PuzzleApi) {
  const required = () => {
    if (!puzzles) {
      throw new Error('拼图服务不可用')
    }
    return puzzles
  }
  host.handle(puzzleIpcChannels.album, () => required().album())
  host.handle(puzzleIpcChannels.selectArtwork, (input) =>
    required().selectArtwork(parseIpcInput(selectPuzzleArtworkInputSchema, input).artworkId),
  )
  host.handle(puzzleIpcChannels.reveal, (input) =>
    required().reveal(parseIpcInput(revealPuzzleRewardInputSchema, input).rewardId),
  )
  host.handle(puzzleIpcChannels.featureArtwork, (input) =>
    required().featureArtwork(parseIpcInput(featurePuzzleArtworkInputSchema, input).artworkId),
  )
}
