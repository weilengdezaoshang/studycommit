import { createHash } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { AiConfigService } from '../ai/ai-config.service'
import { AiConfigRepository } from '../ai/ai-config.repository'
import { CampaignsRepository } from '../campaigns/campaigns.repository'
import { CreditsService } from '../credits/credits.service'

/** 运营引导聚合:客户端登录/回前台/进活动页拉取;缓存仅展示,授权以后端为准。 */
@Injectable()
export class OperationsService {
  constructor(
    @Inject(AiConfigService) private readonly aiConfig: AiConfigService,
    @Inject(AiConfigRepository) private readonly aiConfigRepository: AiConfigRepository,
    @Inject(CampaignsRepository) private readonly campaignsRepository: CampaignsRepository,
    @Inject(CreditsService) private readonly credits: CreditsService,
  ) {}

  async bootstrap(userId: string) {
    const [serviceConfig, activePrice, visibleCampaigns, balance] = await Promise.all([
      this.aiConfig.getServiceConfig(),
      this.aiConfigRepository.findActivePrice('paper_explain'),
      this.campaignsRepository.listVisibleCampaigns(new Date()),
      this.credits.getBalance(userId),
    ])
    // 配置版本:开关/价格/可见活动任一变化即失效客户端缓存。
    const digest = createHash('sha256')
    digest.update(serviceConfig.updatedAt)
    digest.update(`|price:${activePrice?.version ?? 0}`)
    for (const campaign of visibleCampaigns) {
      digest.update(`|${campaign.id}:${campaign.updatedAt.toISOString()}`)
    }
    return {
      serverNow: new Date().toISOString(),
      configVersion: digest.digest('hex').slice(0, 32),
      ai: {
        enabled: serviceConfig.aiEnabled,
        priceVersion: activePrice?.version ?? null,
      },
      credits: {
        available: balance.available,
        reserved: balance.reserved,
      },
    }
  }
}
