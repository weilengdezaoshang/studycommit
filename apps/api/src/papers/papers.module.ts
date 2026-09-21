import { PaperKnowledgeService } from './paper-knowledge.service'
import { Module } from '@nestjs/common'
import { PapersRpcController } from './papers.rpc-controller'
import { PapersRepository } from './papers.repository'
import { PapersService } from './papers.service'
import { UploadsModule } from '../uploads/uploads.module'
import { PuzzlesModule } from '../puzzles/puzzles.module'

@Module({
  imports: [UploadsModule, PuzzlesModule],
  controllers: [PapersRpcController],
  providers: [PapersRepository, PapersService, PaperKnowledgeService],
  exports: [PapersService],
})
export class PapersModule {}
