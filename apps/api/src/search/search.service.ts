import { Inject, Injectable } from '@nestjs/common'
import type { TopicWithTemplate } from '../topics/topics.repository'
import { TopicsRepository } from '../topics/topics.repository'
import type { SearchPaperPage } from './search.repository'
import { SearchRepository } from './search.repository'

export interface SearchResultItem {
  papers: SearchPaperPage
  topics: TopicWithTemplate[]
}

const SEARCH_TOPIC_LIMIT = 10
const SEARCH_PAPER_PAGE_SIZE = 20

@Injectable()
export class SearchService {
  constructor(
    @Inject(SearchRepository) private readonly searchRepository: SearchRepository,
    @Inject(TopicsRepository) private readonly topicsRepository: TopicsRepository,
  ) {}

  async query(
    userId: string,
    rawQuery: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<SearchResultItem> {
    const trimmed = rawQuery.trim()
    const limit = options.limit ?? SEARCH_PAPER_PAGE_SIZE
    const [papers, topics] = await Promise.all([
      this.searchRepository.searchPapers(userId, trimmed, options.cursor, limit),
      options.cursor
        ? Promise.resolve([])
        : this.topicsRepository.searchActiveByName(userId, trimmed, SEARCH_TOPIC_LIMIT),
    ])
    return { papers, topics }
  }
}
