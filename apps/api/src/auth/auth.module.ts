import { Global, Module } from '@nestjs/common'
import { AccessTokenGuard } from './access-token.guard'
import { AuthController } from './auth.controller'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { IdentityGuard } from './identity.guard'
import { MeController } from './me.controller'
import { WechatMiniClient } from './wechat-mini.client'

@Global()
@Module({
  controllers: [AuthController, MeController],
  providers: [AuthRepository, AuthService, WechatMiniClient, AccessTokenGuard, IdentityGuard],
  exports: [AuthService, AccessTokenGuard, IdentityGuard],
})
export class AuthModule {}
