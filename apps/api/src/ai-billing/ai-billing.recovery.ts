import { Inject, Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

/**
 * 计费域的周期性辅助装配位:
 * 执行循环(AiBillingWorker)以数据库为权威自动恢复待办,
 * 此处保留日志上下文与未来对账任务接入点。
 */
@Injectable()
export class AiBillingRecovery {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(AiBillingRecovery.name)
  }
}
