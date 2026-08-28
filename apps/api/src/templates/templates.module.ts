import { Module } from '@nestjs/common'
import { TemplatesController } from './templates.controller'
import { TemplatesRepository } from './templates.repository'
import { TemplatesService } from './templates.service'

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesRepository, TemplatesService],
})
export class TemplatesModule {}
