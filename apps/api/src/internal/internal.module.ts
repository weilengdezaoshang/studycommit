import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { InternalAuthGuard } from './internal-auth.guard'
import { InternalController } from './internal.controller'
import { InternalService } from './internal.service'

@Module({
  imports: [AuthModule],
  controllers: [InternalController],
  providers: [InternalService, InternalAuthGuard],
  exports: [InternalService],
})
export class InternalModule {}
