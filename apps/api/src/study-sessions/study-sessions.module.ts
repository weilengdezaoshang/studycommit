import { Module } from '@nestjs/common'
import { TestIdentityGuard } from '../common/current-user'
import { StudySessionsController } from './study-sessions.controller'
import { StudySessionsRepository } from './study-sessions.repository'
import { StudySessionsService } from './study-sessions.service'

@Module({
  controllers: [StudySessionsController],
  providers: [StudySessionsRepository, StudySessionsService, TestIdentityGuard],
  exports: [StudySessionsRepository],
})
export class StudySessionsModule {}
