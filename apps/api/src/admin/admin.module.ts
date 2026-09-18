import { Module } from '@nestjs/common'
import { AdminAccessModule } from '../admin-access/admin-access.module'
import { AiModule } from '../ai/ai.module'
import { CampaignsModule } from '../campaigns/campaigns.module'
import { AdminRepository } from './admin.repository'
import { AdminRpcController } from './admin.rpc-controller'

@Module({
  imports: [AdminAccessModule, AiModule, CampaignsModule],
  controllers: [AdminRpcController],
  providers: [AdminRepository],
})
export class AdminModule {}
