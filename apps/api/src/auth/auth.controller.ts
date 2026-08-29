import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common'
import {
  refreshInputSchema,
  sendPhoneCodeInputSchema,
  verifyPhoneInputSchema,
} from '@studycommit/rpc-contracts/auth'
import { ZodPipe } from '../common/zod.pipe'
import { AccessTokenGuard, type AuthedRequest } from './access-token.guard'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('phone/code')
  @HttpCode(200)
  sendPhoneCode(@Body(new ZodPipe(sendPhoneCodeInputSchema)) body: { phone: string }) {
    return this.auth.sendPhoneCode(body.phone)
  }

  @Post('phone/verify')
  @HttpCode(200)
  verifyPhone(
    @Body(new ZodPipe(verifyPhoneInputSchema))
    body: {
      phone: string
      code: string
      deviceType: 'desktop' | 'mobile' | 'miniprogram'
    },
  ) {
    return this.auth.verifyPhone(body)
  }

  @Post('token/refresh')
  @HttpCode(200)
  refresh(@Body(new ZodPipe(refreshInputSchema)) body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken)
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  logout(@Req() request: AuthedRequest) {
    return this.auth.logout(request.accessToken)
  }
}
