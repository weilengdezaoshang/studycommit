import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ReviewsRepository } from './reviews.repository'

export const REVIEW_ERROR = {
  invalidTimezone: {
    code: 'REVIEW_TIMEZONE_INVALID',
    message: '时区名称无效，请提供 IANA 时区',
  },
} as const

/** IANA 时区校验:交给运行时的 Intl 支持,未识别名称直接拒绝。 */
export function isIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

@Injectable()
export class ReviewsService {
  constructor(@Inject(ReviewsRepository) private readonly repository: ReviewsRepository) {}

  async monthly(userId: string, month: string, timezone: string) {
    if (!isIanaTimezone(timezone)) {
      throw new BadRequestException(REVIEW_ERROR.invalidTimezone)
    }
    const row = await this.repository.findMonthly(userId, month, timezone)
    return { month, timezone, ...row }
  }
}
