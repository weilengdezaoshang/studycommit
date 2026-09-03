import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiRepository } from './ai.repository'
import { AiService } from './ai.service'

@Module({
  controllers: [AiController],
  providers: [AiRepository, AiService],
  exports: [AiService],
})
export class AiModule {}
