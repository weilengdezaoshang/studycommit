import { Inject, Injectable, Module } from '@nestjs/common'
import { OutboxService } from '../outbox/outbox.service'
import { OUTBOX_EVENT_TYPES } from '../outbox/outbox.constants'
import { CreditsModule } from '../credits/credits.module'
import { OutboxModule } from '../outbox/outbox.module'
import { CampaignsService } from './campaigns.service'
import { CampaignsRepository } from './campaigns.repository'
import { CampaignsRpcController } from './campaigns.rpc-controller'
import type { RegistrationEventPayload } from './campaigns.constants'

/**
 * 活动模块:领取/生命周期服务与注册奖励 outbox 消费者。
 * 消费者幂等依赖 campaign_claims 唯一约束,与至少一次投递兼容。
 */
@Injectable()
export class RegistrationBonusConsumer {
  constructor(
    @Inject(CampaignsService) private readonly campaigns: CampaignsService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  onModuleInit() {
    this.outbox.registerHandler(OUTBOX_EVENT_TYPES.userVerified, async (payload) => {
      // 待补偿结果不视为投递失败:资格已留痕,发放需管理员授权。
      await this.campaigns.consumeRegistrationEvent(payload as unknown as RegistrationEventPayload)
    })
  }
}

@Module({
  imports: [CreditsModule, OutboxModule],
  controllers: [CampaignsRpcController],
  providers: [CampaignsRepository, CampaignsService, RegistrationBonusConsumer],
  exports: [CampaignsRepository, CampaignsService],
})
export class CampaignsModule {}
