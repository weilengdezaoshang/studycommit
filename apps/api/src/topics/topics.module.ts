import { Module } from '@nestjs/common'
import { TopicsController } from './topics.controller'
import { TopicsRepository } from './topics.repository'
import { TopicsService } from './topics.service'
import { TestIdentityGuard } from '../common/current-user'
@Module({ controllers: [TopicsController], providers: [TopicsRepository, TopicsService, TestIdentityGuard] })
export class TopicsModule {}
