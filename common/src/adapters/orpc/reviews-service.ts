import type { ApiOrpcClient } from './client'
import { callOrpc } from './errors'
import type { ReviewApi } from '../../ports'

/** 月度装订统计的 oRPC 适配:契约即端口,无额外映射。 */
export function createOrpcReviewsService(client: ApiOrpcClient): ReviewApi {
  return {
    monthly: (input) => callOrpc(() => client.reviews.monthly(input, { context: {} })),
  }
}
