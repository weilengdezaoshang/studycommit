import { Global, Module } from '@nestjs/common'
import { AuthRpcController } from './auth.rpc-controller'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { IdentityGuard } from './identity.guard'
import { WechatMiniClient } from './wechat-mini.client'

@Global()
@Module({
  controllers: [AuthRpcController],
  providers: [AuthRepository, AuthService, WechatMiniClient, IdentityGuard],
  exports: [AuthService, IdentityGuard],
})
export class AuthModule {}
