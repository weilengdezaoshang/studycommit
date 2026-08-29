import { Module } from '@nestjs/common'
import { LearningLogsController } from './learning-logs.controller'
import { LearningLogsRepository } from './learning-logs.repository'
import { LearningLogsService } from './learning-logs.service'

@Module({
  controllers: [LearningLogsController],
  providers: [LearningLogsRepository, LearningLogsService],
})
export class LearningLogsModule {}
