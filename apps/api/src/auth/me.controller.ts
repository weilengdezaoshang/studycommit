import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common'
import { AccessTokenGuard, type AuthedRequest } from './access-token.guard'
import { AuthService } from './auth.service'

@Controller()
export class MeController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() request: AuthedRequest) {
    return this.auth.me(request.accessToken)
  }
}
