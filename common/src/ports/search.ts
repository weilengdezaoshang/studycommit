import type { SearchResult } from '@studycommit/rpc-contracts/search'

/** 统一搜索(BE-310):命中纸页与箱子;离线或服务端失败时客户端回退本地过滤。 */
export interface SearchApi {
  query(input: { q: string; limit?: number; cursor?: string }): Promise<SearchResult>
}
