import { Module } from '@nestjs/common'
import { TestIdentityGuard } from '../common/current-user'
import { LearningLogsController } from './learning-logs.controller'
import { LearningLogsRepository } from './learning-logs.repository'
import { LearningLogsService } from './learning-logs.service'

@Module({
  controllers: [LearningLogsController],
  providers: [LearningLogsRepository, LearningLogsService, TestIdentityGuard],
})
export class LearningLogsModule {}
