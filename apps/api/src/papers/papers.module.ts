import { Module } from '@nestjs/common'
import { PapersController } from './papers.controller'
import { PapersRepository } from './papers.repository'
import { PapersService } from './papers.service'

@Module({
  controllers: [PapersController],
  providers: [PapersRepository, PapersService],
  exports: [PapersService],
})
export class PapersModule {}
