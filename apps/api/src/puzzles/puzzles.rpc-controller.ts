import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { puzzlesContract } from '@studycommit/rpc-contracts/puzzles'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { PuzzlesService } from './puzzles.service'

@Controller()
@UseGuards(IdentityGuard)
export class PuzzlesRpcController {
  constructor(@Inject(PuzzlesService) private readonly puzzles: PuzzlesService) {}
  @Implement(puzzlesContract)
  router(@Req() request: AuthedRequest) {
    const withAssets = (album: Awaited<ReturnType<PuzzlesService['album']>>) => ({
      ...album,
      artworks: album.artworks.map((a) => ({
        ...a,
        assetUrl: `${request.protocol}://${request.headers.host}/api/puzzles/assets/${encodeURIComponent(a.assetKey)}`,
      })),
    })
    return {
      album: implement(puzzlesContract.album).handler(() =>
        handleOrpc(async () => withAssets(await this.puzzles.album(request.userId))),
      ),
      selectArtwork: implement(puzzlesContract.selectArtwork).handler(({ input }) =>
        handleOrpc(async () =>
          withAssets(await this.puzzles.selectArtwork(request.userId, input.artworkId)),
        ),
      ),
      reveal: implement(puzzlesContract.reveal).handler(({ input }) =>
        handleOrpc(() => this.puzzles.reveal(request.userId, input.rewardId)),
      ),
      featureArtwork: implement(puzzlesContract.featureArtwork).handler(({ input }) =>
        handleOrpc(async () =>
          withAssets(await this.puzzles.featureArtwork(request.userId, input.artworkId)),
        ),
      ),
    }
  }
}
