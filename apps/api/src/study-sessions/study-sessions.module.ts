import { Module } from '@nestjs/common'
import { StudySessionsRpcController } from './study-sessions.rpc-controller'
import { StudySessionsRepository } from './study-sessions.repository'
import { StudySessionsService } from './study-sessions.service'

@Module({
  controllers: [StudySessionsRpcController],
  providers: [StudySessionsRepository, StudySessionsService],
  exports: [StudySessionsRepository],
})
export class StudySessionsModule {}
