import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthController } from './health/health.controller'
import { HealthService } from './health/health.service'
import { InfrastructureModule } from './infrastructure/infrastructure.module'
import { validateEnv } from './config/env'
import { DatabaseModule } from './database/database.module'
import { TopicsModule } from './topics/topics.module'
import { LoggerModule } from 'nestjs-pino'
import { createLoggingConfig, type RuntimeEnvironment } from './common/logging/logging.config'
import { LearningLogsModule } from './learning-logs/learning-logs.module'
import { StudySessionsModule } from './study-sessions/study-sessions.module'
import { ORPCError, ORPCModule } from '@orpc/nest'
import {
  experimental_RethrowHandlerPlugin as RethrowHandlerPlugin,
  ResponseHeadersPlugin,
} from '@orpc/server/plugins'

declare module '@orpc/nest' {
  interface ORPCGlobalContext {
    resHeaders?: Headers
  }
}
import { PapersModule } from './papers/papers.module'
import { TemplatesModule } from './templates/templates.module'
import { AuthModule } from './auth/auth.module'
import { AiModule } from './ai/ai.module'

@Module({
  imports: [
    ORPCModule.forRoot({
      // 插件(如 ResponseHeadersPlugin)要求 context 为对象,缺省 undefined 会导致所有 oRPC 路由 500
      context: {},
      plugins: [
        new ResponseHeadersPlugin(),
        new RethrowHandlerPlugin({ filter: (error) => !(error instanceof ORPCError) }),
      ],
    }),
    LoggerModule.forRoot(
      createLoggingConfig((process.env.NODE_ENV ?? 'development') as RuntimeEnvironment),
    ),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test' ? ['.env.test.local', '.env.test'] : ['.env.local', '.env'],
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
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
