import { z } from 'zod'

/** 月度装订统计(BE-311)与 rpc-contracts/reviews 保持解析一致。 */

export const reviewMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式为 YYYY-MM')

export const reviewDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式为 YYYY-MM-DD'),
  count: z.number().int().nonnegative(),
})

export const monthlyReviewSchema = z.object({
  month: reviewMonthSchema,
  timezone: z.string().min(1).max(64),
  paperCount: z.number().int().nonnegative(),
  topicCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  days: z.array(reviewDaySchema),
})

export type ReviewDay = z.infer<typeof reviewDaySchema>
export type MonthlyReview = z.infer<typeof monthlyReviewSchema>
