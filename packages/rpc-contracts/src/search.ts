import { oc } from '@orpc/contract'
import { z } from 'zod'
import { paperPageSchema } from './papers.js'
import { topicSchema } from './topics.js'

/**
 * 统一搜索(BE-310):命中纸页正文/问题文本与箱子名称。
 * q 1–50 字;纸页按 updated_at 倒序游标分页,箱子返回前 10 个。
 * 隐私红线:q 原文不落日志(服务端日志脱敏 req.query.q)。
 */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  /** (updatedAt, id) keyset 游标,来自上一页 pageInfo.nextCursor */
  cursor: z.string().min(1).optional(),
})

export const searchResultSchema = z.object({
  papers: paperPageSchema,
  topics: z.array(topicSchema).max(10),
})

export const searchContract = {
  query: oc
    .route({ method: 'GET', path: '/search', summary: '搜索纸页与箱子' })
    .input(searchQuerySchema)
    .output(searchResultSchema),
}

export type SearchQuery = z.infer<typeof searchQuerySchema>
export type SearchResult = z.infer<typeof searchResultSchema>
