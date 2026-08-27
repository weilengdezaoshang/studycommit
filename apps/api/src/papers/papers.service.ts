import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { createHash } from 'node:crypto'
import type { CreatePaperInput, ListPapersInput, Paper } from '@studycommit/rpc-contracts/papers'
import { IDEMPOTENCY_ERROR, IDEMPOTENCY_RECORDS_PKEY, isConstraint } from '../common/idempotency'
import { PAPER_CREATE_KIND, PAPER_ERROR } from './papers.constants'
import { PapersRepository } from './papers.repository'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

type PaperRow = {
  id: string
  content: string
  topicId: string | null
  version: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

@Injectable()
export class PapersService {
  constructor(@Inject(PapersRepository) private readonly repository: PapersRepository) {}

  async create(userId: string, input: CreatePaperInput, key: string) {
    const requestHash = hash(input)
    try {
      return this.mapCreateResult(
        await this.repository.create(userId, input, { key, hash: requestHash }),
      )
    } catch (error) {
      if (isConstraint(error, IDEMPOTENCY_RECORDS_PKEY)) {
        return this.mapCreateResult(
          await this.repository.create(userId, input, { key, hash: requestHash }),
        )
      }
      throw error
    }
  }

  async get(userId: string, id: string) {
    const paper = await this.repository.findById(userId, id)
    if (!paper) {
      throw new NotFoundException(PAPER_ERROR.notFound)
    }
    return this.toPaper(paper)
  }

  async list(userId: string, input: ListPapersInput) {
    try {
      const page = await this.repository.list(userId, input)
      return { ...page, items: page.items.map((paper) => this.toPaper(paper)) }
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CURSOR') {
        throw new BadRequestException({ code: 'INVALID_CURSOR', message: '分页游标无效' })
      }
      throw error
    }
  }

  private mapCreateResult(result: Awaited<ReturnType<PapersRepository['create']>>) {
    if (result.kind === PAPER_CREATE_KIND.ok) {
      return { paper: this.toPaper(result.paper), replayed: result.replayed }
    }
    throw new ConflictException(IDEMPOTENCY_ERROR.keyReused)
  }

  private toPaper(row: PaperRow): Paper {
    return {
      id: row.id,
      content: row.content,
      status: row.topicId ? 'organized' : 'inbox',
      topicId: row.topicId,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  }
}
