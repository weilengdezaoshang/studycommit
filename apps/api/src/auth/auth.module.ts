import { Global, Module } from '@nestjs/common'
import { AccessTokenGuard } from './access-token.guard'
import { AuthController } from './auth.controller'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { IdentityGuard } from './identity.guard'
import { MeController } from './me.controller'

@Global()
@Module({
  controllers: [AuthController, MeController],
  providers: [AuthRepository, AuthService, AccessTokenGuard, IdentityGuard],
  exports: [AuthService, AccessTokenGuard, IdentityGuard],
})
export class AuthModule {}
