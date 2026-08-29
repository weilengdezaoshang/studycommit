import { Controller, Get, Inject, UseGuards } from '@nestjs/common'
import { CurrentUserId } from '../common/current-user'
import { IdentityGuard } from '../auth/identity.guard'
import { TemplatesService } from './templates.service'

@Controller('templates')
@UseGuards(IdentityGuard)
export class TemplatesController {
  constructor(@Inject(TemplatesService) private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUserId() userId: string) {
    return this.templates.list(userId)
  }
}
