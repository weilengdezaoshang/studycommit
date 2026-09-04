import { Module } from '@nestjs/common'
import { PapersRpcController } from './papers.rpc-controller'
import { PapersRepository } from './papers.repository'
import { PapersService } from './papers.service'

@Module({
  controllers: [PapersRpcController],
  providers: [PapersRepository, PapersService],
  exports: [PapersService],
})
export class PapersModule {}
