import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthController } from './health/health.controller'
import { HealthService } from './health/health.service'
import { InfrastructureModule } from './infrastructure/infrastructure.module'
import { validateEnv } from './config/env'
import { DatabaseModule } from './database/database.module'
import { TopicsModule } from './topics/topics.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? ['.env.test.local', '.env.test'] : ['.env.local', '.env'],
      validate: validateEnv
    }),
    DatabaseModule,
    InfrastructureModule,
    TopicsModule
  ],
  controllers: [HealthController],
  providers: [HealthService]
})
export class AppModule {}
