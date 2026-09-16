import { searchResultSchema, type SearchResult } from '@studycommit/rpc-contracts/search'
import type { MiniprogramTransport } from '../transport/transport.types'

export type SearchQueryInput = { q: string; limit?: number; cursor?: string }

export interface SearchService {
  query(input: SearchQueryInput): Promise<SearchResult>
}

export function createSearchService(transport: MiniprogramTransport): SearchService {
  return {
    query(input) {
      return transport.call('search.query', input).then((value) => searchResultSchema.parse(value))
    },
  }
}
