import { Controller, Inject, Req, UseGuards } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import { reviewsContract } from '@studycommit/rpc-contracts/reviews'
import type { AuthedRequest } from '../auth/identity.guard'
import { IdentityGuard } from '../auth/identity.guard'
import { handleOrpc } from '../common/orpc-error'
import { ReviewsService } from './reviews.service'

@Controller()
@UseGuards(IdentityGuard)
export class ReviewsRpcController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Implement(reviewsContract)
  reviewsRouter(@Req() request: AuthedRequest) {
    return {
      monthly: implement(reviewsContract.monthly).handler(({ input }) =>
        handleOrpc(() => this.reviews.monthly(request.userId, input.month, input.timezone)),
      ),
    }
  }
}
