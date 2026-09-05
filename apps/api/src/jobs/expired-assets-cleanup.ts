import { Inject, Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PinoLogger } from 'nestjs-pino'
import { UploadsService } from '../uploads/uploads.service'

/** 每小时回收过期未完成的直传会话:删除对象 + 软删行(V3 计划 BE-308 清理任务)。 */
@Injectable()
export class ExpiredAssetsCleanupJob {
  constructor(
    @Inject(UploadsService) private readonly uploads: UploadsService,
    // 显式 @Inject:esbuild 转译不生成装饰器参数元数据,缺省会导致依赖解析失败
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ExpiredAssetsCleanupJob.name)
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handle(): Promise<void> {
    try {
      const cleaned = await this.uploads.cleanupExpired(new Date())
      if (cleaned > 0) {
        this.logger.info({ cleaned }, '过期上传会话已清理')
      }
    } catch (error) {
      this.logger.error({ error }, '过期上传会话清理失败')
    }
  }
}
