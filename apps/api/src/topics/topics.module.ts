import { Module } from '@nestjs/common'
import { TopicsRpcController } from './topics.rpc-controller'
import { TopicsRepository } from './topics.repository'
import { TopicsService } from './topics.service'
@Module({
  controllers: [TopicsRpcController],
  providers: [TopicsRepository, TopicsService],
})
export class TopicsModule {}
