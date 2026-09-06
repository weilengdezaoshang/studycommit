import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { searchContract } from '@studycommit/rpc-contracts/search'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import type { TopicWithTemplate } from '../topics/topics.repository'
import type { Paper } from './search.repository'
import { SearchService } from './search.service'

function paperSourceOf(value: string): 'mobile_direct' | 'desktop_capture' | 'desktop_session' {
  return value === 'desktop_capture' || value === 'desktop_session' ? value : 'mobile_direct'
}

type PaperRow = Paper & {
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string | null
}

/** 与 papers 模块的纸页输出保持一致(status 由 topicId 派生)。 */
function toPaperOutput(row: PaperRow) {
  return {
    id: row.id,
    content: row.content,
    status: row.topicId ? ('organized' as const) : ('inbox' as const),
    topicId: row.topicId,
    version: row.version,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    deletedAt: toNullableIso(row.deletedAt),
    hasQuestion: row.hasQuestion,
    isQuestionResolved: row.isQuestionResolved,
    questionStatus: row.questionStatus,
    questionText: row.questionText,
    understandingText: row.understandingText,
    questionResolvedAt: toNullableIso(row.questionResolvedAt),
    source: paperSourceOf(row.source),
    sourceSessionId: row.sourceSessionId,
  }
}

function toTopicOutput(topic: TopicWithTemplate) {
  return {
    ...topic,
    lastPaperAt: topic.lastPaperAt?.toISOString() ?? null,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
    deletedAt: topic.deletedAt?.toISOString() ?? null,
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toNullableIso(value: Date | string | null): string | null {
  return value === null ? null : toIso(value)
}

@Controller()
@UseGuards(IdentityGuard)
export class SearchRpcController {
  constructor(@Inject(SearchService) private readonly search: SearchService) {}

  @Implement(searchContract)
  searchRouter(@Req() request: AuthedRequest) {
    return {
      query: implement(searchContract.query).handler(({ input }) =>
        handleOrpc(async () => {
          const result = await this.search.query(request.userId, input.q, {
            cursor: input.cursor,
            limit: input.limit,
          })
          return {
            papers: {
              items: result.papers.items.map(toPaperOutput),
              pageInfo: result.papers.pageInfo,
            },
            topics: result.topics.map(toTopicOutput),
          }
        }),
      ),
    }
  }
}
