import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { papers } from '../database/schema'
import { escapeLikePattern } from '../common/escape-like'

export type Paper = typeof papers.$inferSelect

export interface SearchPaperPage {
  items: Paper[]
  pageInfo: { hasNextPage: boolean; nextCursor: string | null }
}

const SEARCH_STATEMENT_TIMEOUT = '2s'

const encodeCursor = (paper: Paper) =>
  Buffer.from(JSON.stringify({ updatedAt: paper.updatedAt.toISOString(), id: paper.id })).toString(
    'base64url',
  )

function decodeCursor(value: string): { updatedAt: string; id: string } {
  const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as {
    updatedAt?: unknown
    id?: unknown
  }
  if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string') {
    throw new Error('INVALID_CURSOR')
  }
  return { updatedAt: parsed.updatedAt, id: parsed.id }
}

@Injectable()
export class SearchRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 纸页搜索:命中正文或问题文本,updated_at 倒序游标分页;statement_timeout 兜底慢查询。 */
  async searchPapers(
    userId: string,
    query: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<SearchPaperPage> {
    const pattern = `%${escapeLikePattern(query)}%`
    return this.database.db.transaction(async (tx) => {
      // SET 语句不支持参数化,改用 set_config(is_local=true) 限定在事务内生效
      await tx.execute(
        sql`SELECT set_config('statement_timeout', ${SEARCH_STATEMENT_TIMEOUT}, true)`,
      )
      const conditions = [
        eq(papers.userId, userId),
        isNull(papers.deletedAt),
        or(sql`${papers.content} ILIKE ${pattern}`, sql`${papers.questionText} ILIKE ${pattern}`)!,
      ]
      if (cursor) {
        const decoded = decodeCursor(cursor)
        const updatedAt = sql<Date>`date_trunc('milliseconds', ${papers.updatedAt})`
        conditions.push(
          or(
            lt(updatedAt, new Date(decoded.updatedAt)),
            and(eq(updatedAt, new Date(decoded.updatedAt)), lt(papers.id, decoded.id)),
          )!,
        )
      }
      const rows = await tx
        .select()
        .from(papers)
        .where(and(...conditions))
        .orderBy(desc(papers.updatedAt), desc(papers.id))
        .limit(limit + 1)
      const hasNextPage = rows.length > limit
      const items = hasNextPage ? rows.slice(0, limit) : rows
      return {
        items,
        pageInfo: {
          hasNextPage,
          nextCursor: hasNextPage ? encodeCursor(items.at(-1)!) : null,
        },
      }
    })
  }
}
