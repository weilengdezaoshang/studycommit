import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { CampaignsModule } from '../campaigns/campaigns.module'
import { CreditsModule } from '../credits/credits.module'
import { OperationsRpcController } from './operations.rpc-controller'
import { OperationsService } from './operations.service'

@Module({
  imports: [AiModule, CampaignsModule, CreditsModule],
  controllers: [OperationsRpcController],
  providers: [OperationsService],
})
export class OperationsModule {}
