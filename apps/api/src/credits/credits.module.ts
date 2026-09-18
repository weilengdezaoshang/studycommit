import { Module } from '@nestjs/common'
import { CreditsRepository } from './credits.repository'
import { CreditsRpcController } from './credits.rpc-controller'
import { CreditsService } from './credits.service'

@Module({
  controllers: [CreditsRpcController],
  providers: [CreditsRepository, CreditsService],
  exports: [CreditsRepository, CreditsService],
})
export class CreditsModule {}
