import { monthlyReviewQuerySchema } from '@studycommit/rpc-contracts/reviews'
import type { ReviewApi } from '@studycommit/common/ports'
import { reviewIpcChannels } from '../../shared/review-channels'
import { parseIpcInput, type IpcHost } from './ipc-host'

export { reviewIpcChannels }

export function registerReviewIpc(host: IpcHost, reviews: ReviewApi): void {
  host.handle(reviewIpcChannels.monthly, (input) =>
    reviews.monthly(
      parseIpcInput<{ month: string; timezone: string }>(monthlyReviewQuerySchema, input ?? {}),
    ),
  )
}
