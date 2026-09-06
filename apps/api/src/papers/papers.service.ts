import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { createHash } from 'node:crypto'
import type {
  CreatePaperInput,
  ListPapersInput,
  OrganizePaperInput,
  Paper,
  PaperCommandInput,
  UpdatePaperInput,
  UpdatePaperQuestionInput,
} from '@studycommit/rpc-contracts/papers'
import { IDEMPOTENCY_ERROR, IDEMPOTENCY_RECORDS_PKEY, isConstraint } from '../common/idempotency'
import { TOPIC_ERROR } from '../topics/topic.constants'
import {
  PAPER_COMMAND_KIND,
  PAPER_CREATE_KIND,
  PAPER_ERROR,
  PAPER_ORGANIZE_KIND,
  PAPER_QUESTION_KIND,
} from './papers.constants'
import {
  PapersRepository,
  type PaperCommandResult,
  type PaperOrganizeResult,
} from './papers.repository'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

const organizeErrors: Record<
  Exclude<
    PaperOrganizeResult['kind'],
    typeof PAPER_ORGANIZE_KIND.ok | typeof PAPER_ORGANIZE_KIND.versionConflict
  >,
  () => Error
> = {
  [PAPER_ORGANIZE_KIND.notFound]: () => new NotFoundException(PAPER_ERROR.notFound),
  [PAPER_ORGANIZE_KIND.topicNotFound]: () => new NotFoundException(TOPIC_ERROR.notFound),
  [PAPER_ORGANIZE_KIND.topicArchived]: () => new ConflictException(TOPIC_ERROR.archived),
}

type PaperRow = {
  id: string
  content: string
  topicId: string | null
  version: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  hasQuestion: boolean
  isQuestionResolved: boolean
  questionStatus: 'none' | 'thinking' | 'resolved'
  questionText: string | null
  understandingText: string | null
  questionResolvedAt: Date | null
  source: string
  sourceSessionId: string | null
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

  async organize(userId: string, input: OrganizePaperInput) {
    const result = await this.repository.organize(userId, input)
    if (result.kind === PAPER_ORGANIZE_KIND.ok) {
      return this.toPaper(result.paper)
    }
    if (result.kind === PAPER_ORGANIZE_KIND.versionConflict) {
      throw new ConflictException({
        ...PAPER_ERROR.versionConflict,
        details: { paper: this.toPaper(result.paper) },
      })
    }
    throw organizeErrors[result.kind]()
  }

  async update(userId: string, input: UpdatePaperInput) {
    return this.mapWrite(await this.repository.update(userId, input))
  }

  async updateQuestion(userId: string, input: UpdatePaperQuestionInput) {
    const result = await this.repository.updateQuestion(userId, input)
    if (result.kind === PAPER_QUESTION_KIND.ok) {
      return this.toPaper(result.paper)
    }
    if (result.kind === PAPER_QUESTION_KIND.versionConflict) {
      throw new ConflictException({
        ...PAPER_ERROR.versionConflict,
        details: { paper: this.toPaper(result.paper) },
      })
    }
    if (result.kind === PAPER_QUESTION_KIND.invalidTransition) {
      throw new BadRequestException(
        result.reason === 'question_text_required'
          ? PAPER_ERROR.questionTextRequired
          : PAPER_ERROR.questionTransitionInvalid,
      )
    }
    throw new NotFoundException(PAPER_ERROR.notFound)
  }

  async restore(userId: string, input: PaperCommandInput) {
    return this.mapWrite(await this.repository.restore(userId, input))
  }

  async moveToInbox(userId: string, input: PaperCommandInput) {
    return this.mapWrite(await this.repository.moveToInbox(userId, input))
  }

  async remove(userId: string, input: PaperCommandInput) {
    const result = await this.repository.remove(userId, input)
    if (result.kind === PAPER_COMMAND_KIND.ok) {
      if (!result.paper.deletedAt) {
        throw new NotFoundException(PAPER_ERROR.notFound)
      }
      return {
        id: result.paper.id,
        version: result.paper.version,
        deletedAt: result.paper.deletedAt.toISOString(),
      }
    }
    if (result.kind === PAPER_COMMAND_KIND.versionConflict) {
      throw new ConflictException({
        ...PAPER_ERROR.versionConflict,
        details: { paper: this.toPaper(result.paper) },
      })
    }
    throw new NotFoundException(PAPER_ERROR.notFound)
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

  private mapWrite(result: PaperCommandResult): Paper {
    if (result.kind === PAPER_COMMAND_KIND.ok) {
      return this.toPaper(result.paper)
    }
    if (result.kind === PAPER_COMMAND_KIND.versionConflict) {
      throw new ConflictException({
        ...PAPER_ERROR.versionConflict,
        details: { paper: this.toPaper(result.paper) },
      })
    }
    throw new NotFoundException(PAPER_ERROR.notFound)
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
      hasQuestion: row.hasQuestion,
      isQuestionResolved: row.isQuestionResolved,
      questionStatus: row.questionStatus,
      questionText: row.questionText,
      understandingText: row.understandingText,
      questionResolvedAt: row.questionResolvedAt?.toISOString() ?? null,
      source:
        row.source === 'desktop_capture' || row.source === 'desktop_session'
          ? row.source
          : ('mobile_direct' as const),
      sourceSessionId: row.sourceSessionId,
    }
  }
}
