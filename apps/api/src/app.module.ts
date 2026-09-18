import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthController } from './health/health.controller'
import { HealthService } from './health/health.service'
import { InfrastructureModule } from './infrastructure/infrastructure.module'
import { validateEnv } from './config/env'
import { getEnvFiles } from './config/env-files'
import { DatabaseModule } from './database/database.module'
import { TopicsModule } from './topics/topics.module'
import { LoggerModule } from 'nestjs-pino'
import { createLoggingConfig, type RuntimeEnvironment } from './common/logging/logging.config'
import { LearningLogsModule } from './learning-logs/learning-logs.module'
import { StudySessionsModule } from './study-sessions/study-sessions.module'
import { ORPCModule } from '@orpc/nest'
import { ResponseHeadersPlugin } from '@orpc/server/plugins'

declare module '@orpc/nest' {
  interface ORPCGlobalContext {
    resHeaders?: Headers
  }
}
import { PapersModule } from './papers/papers.module'
import { TemplatesModule } from './templates/templates.module'
import { AuthModule } from './auth/auth.module'
import { AiModule } from './ai/ai.module'
import { UploadsModule } from './uploads/uploads.module'
import { ReviewsModule } from './reviews/reviews.module'
import { SearchModule } from './search/search.module'
import { InternalModule } from './internal/internal.module'
import { OutboxModule } from './outbox/outbox.module'
import { CreditsModule } from './credits/credits.module'
import { CampaignsModule } from './campaigns/campaigns.module'
import { AdminAccessModule } from './admin-access/admin-access.module'
import { AdminModule } from './admin/admin.module'
import { OperationsModule } from './operations/operations.module'
import { AiBillingModule } from './ai-billing/ai-billing.module'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'

@Module({
  imports: [
    ORPCModule.forRoot({
      // 插件(如 ResponseHeadersPlugin)要求 context 为对象,缺省 undefined 会导致所有 oRPC 路由 500
      context: {},
      plugins: [new ResponseHeadersPlugin()],
    }),
    ScheduleModule.forRoot(),
    // HTTP 层基础限流(IP 级);业务级权威上限在受理事务内校验。
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    LoggerModule.forRoot(
      createLoggingConfig((process.env.NODE_ENV ?? 'development') as RuntimeEnvironment),
    ),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFiles(),
      validate: validateEnv,
    }),
    DatabaseModule,
    InfrastructureModule,
    TopicsModule,
    StudySessionsModule,
    LearningLogsModule,
    PapersModule,
    TemplatesModule,
    AuthModule,
    AiModule,
    UploadsModule,
    ReviewsModule,
    SearchModule,
    InternalModule,
    OutboxModule,
    CreditsModule,
    CampaignsModule,
    OperationsModule,
    AdminAccessModule,
    AdminModule,
    AiBillingModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
