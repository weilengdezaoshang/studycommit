import { Module } from '@nestjs/common'
import { ExpiredAssetsCleanupJob } from '../jobs/expired-assets-cleanup'
import { StorageGatewayProvider } from './storage.gateway'
import { UploadsRepository } from './uploads.repository'
import { UploadsRpcController } from './uploads.rpc-controller'
import { UploadsService } from './uploads.service'

@Module({
  controllers: [UploadsRpcController],
  providers: [StorageGatewayProvider, UploadsRepository, UploadsService, ExpiredAssetsCleanupJob],
  exports: [UploadsRepository, UploadsService],
})
export class UploadsModule {}
