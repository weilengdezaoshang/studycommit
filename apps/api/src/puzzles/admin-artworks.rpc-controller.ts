import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { adminPuzzlesContract as contract } from '@studycommit/rpc-contracts/puzzles'
import { AdminGuard, type AdminRequest } from '../admin-access/admin-access.guard'
import { AdminAccessService } from '../admin-access/admin-access.service'
import { handleOrpc } from '../common/orpc-error'
import { AdminArtworksService } from './admin-artworks.service'
import { ArtworkAssetsService } from './artwork-assets.service'

@Controller()
@UseGuards(AdminGuard)
export class AdminArtworksController {
  constructor(
    @Inject(AdminArtworksService) private readonly artworks: AdminArtworksService,
    @Inject(AdminAccessService) private readonly access: AdminAccessService,
    @Inject(ArtworkAssetsService) private readonly assetsService: ArtworkAssetsService,
  ) {}
  @Implement(contract)
  router(@Req() request: AdminRequest) {
    return {
      list: implement(contract.list).handler(() => handleOrpc(() => this.artworks.list())),
      assets: implement(contract.assets).handler(async () => ({
        items: await this.assetsService.list(),
      })),
      prepareAsset: implement(contract.prepareAsset).handler(({ input }) =>
        handleOrpc(() => {
          this.access.requireRole(request.adminIdentity, 'operator')
          return this.assetsService.prepare(input)
        }),
      ),
      completeAsset: implement(contract.completeAsset).handler(({ input }) =>
        handleOrpc(() => {
          this.access.requireRole(request.adminIdentity, 'operator')
          return this.assetsService.complete(input)
        }),
      ),
      deleteAsset: implement(contract.deleteAsset).handler(({ input }) =>
        handleOrpc(() => {
          this.access.requireRole(request.adminIdentity, 'operator')
          return this.assetsService.remove(input.key)
        }),
      ),
      create: implement(contract.create).handler(({ input }) =>
        handleOrpc(() => {
          this.access.requireRole(request.adminIdentity, 'operator')
          return this.artworks.write(request.adminIdentity.userId, {
            draft: input,
            reason: input.reason,
          })
        }),
      ),
      update: implement(contract.update).handler(({ input }) =>
        handleOrpc(() => {
          this.access.requireRole(request.adminIdentity, 'operator')
          return this.artworks.write(request.adminIdentity.userId, {
            id: input.id,
            expectedVersion: input.expectedVersion,
            draft: input,
            reason: input.reason,
          })
        }),
      ),
      transition: implement(contract.transition).handler(({ input }) =>
        handleOrpc(() => {
          this.access.requireRole(request.adminIdentity, 'publisher')
          return this.artworks.write(request.adminIdentity.userId, input)
        }),
      ),
    }
  }
}
