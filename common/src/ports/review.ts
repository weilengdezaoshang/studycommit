import type { MonthlyReview } from '../contracts/review'

/** 月度装订统计(BE-311):时区必填,服务端按用户时区聚合日界。 */
export interface ReviewApi {
  monthly(input: { month: string; timezone: string }): Promise<MonthlyReview>
}
