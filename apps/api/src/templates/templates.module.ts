import { Module } from '@nestjs/common'
import { TemplatesRpcController } from './templates.rpc-controller'
import { TemplatesRepository } from './templates.repository'
import { TemplatesService } from './templates.service'

@Module({
  controllers: [TemplatesRpcController],
  providers: [TemplatesRepository, TemplatesService],
})
export class TemplatesModule {}
