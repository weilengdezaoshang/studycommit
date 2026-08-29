import { Module } from '@nestjs/common'
import { AccessTokenGuard } from './access-token.guard'
import { AuthController } from './auth.controller'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { MeController } from './me.controller'

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthRepository, AuthService, AccessTokenGuard],
})
export class AuthModule {}
