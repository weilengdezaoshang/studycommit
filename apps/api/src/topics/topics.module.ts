import { Module } from '@nestjs/common'
import { TopicsRpcController } from './topics.rpc-controller'
import { TopicsRepository } from './topics.repository'
import { TopicsService } from './topics.service'
@Module({
  controllers: [TopicsRpcController],
  providers: [TopicsRepository, TopicsService],
  // 搜索模块复用箱子仓查询(BE-310)
  exports: [TopicsRepository],
})
export class TopicsModule {}
