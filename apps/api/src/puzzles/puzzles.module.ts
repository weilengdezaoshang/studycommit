import { Module } from '@nestjs/common'
import { PuzzlesRepository } from './puzzles.repository'
import { PuzzlesRpcController } from './puzzles.rpc-controller'
import { PuzzlesService } from './puzzles.service'
import { AdminAccessModule } from '../admin-access/admin-access.module'
import { AdminArtworksService } from './admin-artworks.service'
import { AdminArtworksController } from './admin-artworks.rpc-controller'
import { PuzzleAssetsController } from './puzzle-assets.controller'
import { UploadsModule } from '../uploads/uploads.module'
import { ArtworkAssetsService } from './artwork-assets.service'

@Module({
  imports: [AdminAccessModule, UploadsModule],
  controllers: [PuzzlesRpcController, AdminArtworksController, PuzzleAssetsController],
  providers: [PuzzlesRepository, PuzzlesService, AdminArtworksService, ArtworkAssetsService],
  exports: [PuzzlesRepository],
})
export class PuzzlesModule {}
