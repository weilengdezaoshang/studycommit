import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common'
import {
  accountLoginInputSchema,
  accountRegisterInputSchema,
  refreshInputSchema,
  sendPhoneCodeInputSchema,
  verifyPhoneInputSchema,
  wechatMiniprogramLoginInputSchema,
  type AccountLoginInput,
  type AccountRegisterInput,
} from '@studycommit/rpc-contracts/auth'
import { ZodPipe } from '../common/zod.pipe'
import { AccessTokenGuard, type AuthedRequest } from './access-token.guard'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // 手机验证码登录入口：短信服务尚未接入，验证码目前只写入 Redis，
  // 用户实际收不到短信；联调时需手动从 Redis 读取 auth:otp:* 的值。
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

  @Post('account/register')
  @HttpCode(201)
  registerAccount(@Body(new ZodPipe(accountRegisterInputSchema)) body: AccountRegisterInput) {
    return this.auth.registerAccount(body)
  }

  @Post('account/login')
  @HttpCode(200)
  loginAccount(@Body(new ZodPipe(accountLoginInputSchema)) body: AccountLoginInput) {
    return this.auth.loginAccount(body)
  }

  @Post('wechat/miniprogram')
  @HttpCode(200)
  loginWechatMiniprogram(
    @Body(new ZodPipe(wechatMiniprogramLoginInputSchema)) body: { code: string },
  ) {
    return this.auth.loginWechatMiniprogram(body.code)
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
