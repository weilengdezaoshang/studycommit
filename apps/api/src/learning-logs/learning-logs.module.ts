import { Module } from '@nestjs/common'
import { LearningLogsRpcController } from './learning-logs.rpc-controller'
import { LearningLogsRepository } from './learning-logs.repository'
import { LearningLogsService } from './learning-logs.service'

@Module({
  controllers: [LearningLogsRpcController],
  providers: [LearningLogsRepository, LearningLogsService],
})
export class LearningLogsModule {}
