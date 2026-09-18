import { Module } from '@nestjs/common'
import { OutboxRepository } from './outbox.repository'
import { OutboxService } from './outbox.service'

@Module({
  providers: [OutboxRepository, OutboxService],
  exports: [OutboxRepository, OutboxService],
})
export class OutboxModule {}
