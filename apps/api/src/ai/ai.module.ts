import { Module } from '@nestjs/common'
import { AiRpcController } from './ai.rpc-controller'
import { AiRepository } from './ai.repository'
import { AiService } from './ai.service'

@Module({
  controllers: [AiRpcController],
  providers: [AiRepository, AiService],
  exports: [AiService],
})
export class AiModule {}
