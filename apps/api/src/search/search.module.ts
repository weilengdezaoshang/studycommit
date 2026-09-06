import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { TopicsModule } from '../topics/topics.module'
import { SearchRepository } from './search.repository'
import { SearchRpcController } from './search.rpc-controller'
import { SearchService } from './search.service'

@Module({
  imports: [DatabaseModule, TopicsModule],
  controllers: [SearchRpcController],
  providers: [SearchRepository, SearchService],
})
export class SearchModule {}
