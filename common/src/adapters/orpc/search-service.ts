import type { ApiOrpcClient } from './client'
import { callOrpc } from './errors'
import type { SearchApi } from '../../ports'

/** 统一搜索的 oRPC 适配:契约即端口,无额外映射。 */
export function createOrpcSearchService(client: ApiOrpcClient): SearchApi {
  return {
    query: (input) => callOrpc(() => client.search.query(input, { context: {} })),
  }
}
