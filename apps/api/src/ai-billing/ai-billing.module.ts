import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { AiRpcController } from '../ai/ai.rpc-controller'
import { CreditsModule } from '../credits/credits.module'
import { AiBillingRepository } from './ai-billing.repository'
import { AiBillingService } from './ai-billing.service'
import { AiBillingWorker } from './ai-billing.worker'
import { AiBillingRecovery } from './ai-billing.recovery'

@Module({
  imports: [AiModule, CreditsModule],
  controllers: [AiRpcController],
  providers: [AiBillingRepository, AiBillingService, AiBillingWorker, AiBillingRecovery],
  exports: [AiBillingService],
})
export class AiBillingModule {}
