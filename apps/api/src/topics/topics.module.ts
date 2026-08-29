import { Module } from '@nestjs/common'
import { TopicsController } from './topics.controller'
import { TopicsRepository } from './topics.repository'
import { TopicsService } from './topics.service'
@Module({
  controllers: [TopicsController],
  providers: [TopicsRepository, TopicsService],
})
export class TopicsModule {}
