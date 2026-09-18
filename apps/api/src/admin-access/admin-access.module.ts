import { Module } from '@nestjs/common'
import { AdminAccessRepository } from './admin-access.repository'
import { AdminAccessService } from './admin-access.service'

@Module({
  providers: [AdminAccessRepository, AdminAccessService],
  exports: [AdminAccessRepository, AdminAccessService],
})
export class AdminAccessModule {}
