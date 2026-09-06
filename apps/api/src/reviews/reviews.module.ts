import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { ReviewsRepository } from './reviews.repository'
import { ReviewsRpcController } from './reviews.rpc-controller'
import { ReviewsService } from './reviews.service'

@Module({
  imports: [DatabaseModule],
  controllers: [ReviewsRpcController],
  providers: [ReviewsRepository, ReviewsService],
})
export class ReviewsModule {}
