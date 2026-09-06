import { oc } from '@orpc/contract'
import { z } from 'zod'

/**
 * 月度装订与热力统计(BE-311)。
 * 月份与 IANA 时区必填:服务端按用户时区聚合日界,不得按服务器时区分组。
 * 不使用学习时长作指标(PRD 反打卡)。
 */

export const reviewMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式为 YYYY-MM')

export const reviewDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式为 YYYY-MM-DD')

export const monthlyReviewQuerySchema = z.object({
  month: reviewMonthSchema,
  /** IANA 时区名称,如 Asia/Shanghai */
  timezone: z.string().trim().min(1).max(64),
})

export const reviewDaySchema = z.object({
  date: reviewDateSchema,
  count: z.number().int().nonnegative(),
})

export const monthlyReviewSchema = z.object({
  month: reviewMonthSchema,
  timezone: z.string().min(1).max(64),
  /** 当月未删除纸页数 */
  paperCount: z.number().int().nonnegative(),
  /** 当月有纸页归属的箱子数(装订语义) */
  topicCount: z.number().int().nonnegative(),
  /** 当月解决的问题数 */
  resolvedCount: z.number().int().nonnegative(),
  /** 当月有纸页的日期(热力图),按日期升序 */
  days: z.array(reviewDaySchema),
})

export const reviewsContract = {
  monthly: oc
    .route({ method: 'GET', path: '/reviews/monthly', summary: '月度装订统计' })
    .input(monthlyReviewQuerySchema)
    .output(monthlyReviewSchema),
}

export type ReviewMonth = z.infer<typeof reviewMonthSchema>
export type ReviewDay = z.infer<typeof reviewDaySchema>
export type MonthlyReview = z.infer<typeof monthlyReviewSchema>
