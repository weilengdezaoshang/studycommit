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

@Module({
  imports: [
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
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
