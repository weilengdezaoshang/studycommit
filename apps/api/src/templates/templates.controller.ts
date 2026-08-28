import { Controller, Get, Inject, UseGuards } from '@nestjs/common'
import { CurrentUserId, TestIdentityGuard } from '../common/current-user'
import { TemplatesService } from './templates.service'

@Controller('templates')
@UseGuards(TestIdentityGuard)
export class TemplatesController {
  constructor(@Inject(TemplatesService) private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.templates.list(userId)
  }
}
