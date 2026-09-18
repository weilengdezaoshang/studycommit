import { Module } from '@nestjs/common'
import { AI_PROVIDER_TOKEN } from './ai-provider'
import { AiConfigRepository } from './ai-config.repository'
import { AiConfigService } from './ai-config.service'
import { AiProviderConfigService } from './ai-provider-config.service'
import { AiRepository } from './ai.repository'
import { AiService } from './ai.service'

/** AI 执行域:供应商调用/输出解析/配置;RPC 层由 AiBillingModule 装配(计费统一入口)。 */
@Module({
  providers: [
    AiRepository,
    AiService,
    AiConfigRepository,
    AiConfigService,
    AiProviderConfigService,
    // 默认槽位为 null,每次请求从数据库或环境解析。
    { provide: AI_PROVIDER_TOKEN, useValue: null },
  ],
  exports: [AiService, AiConfigRepository, AiConfigService, AiProviderConfigService],
})
export class AiModule {}
