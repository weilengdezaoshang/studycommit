import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'

/** 月度装订统计行(BE-311);日界按用户时区聚合,不按服务器时区。 */
export interface MonthlyReviewRow {
  paperCount: number
  topicCount: number
  resolvedCount: number
  days: { date: string; count: number }[]
}

@Injectable()
export class ReviewsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findMonthly(userId: string, month: string, timezone: string): Promise<MonthlyReviewRow> {
    const [counts] = (
      await this.database.db.execute(sql`
        SELECT
          count(*)::int AS paper_count,
          count(DISTINCT topic_id)::int AS topic_count,
          count(*) FILTER (
            WHERE question_status = 'resolved'
              AND to_char(question_resolved_at AT TIME ZONE ${timezone}, 'YYYY-MM') = ${month}
          )::int AS resolved_count
        FROM papers
        WHERE user_id = ${userId}
          AND deleted_at IS NULL
          AND to_char(created_at AT TIME ZONE ${timezone}, 'YYYY-MM') = ${month}
      `)
    ).rows as unknown as {
      paper_count: number
      topic_count: number
      resolved_count: number
    }[]

    const dayRows = (
      await this.database.db.execute(sql`
        SELECT to_char(created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, count(*)::int AS count
        FROM papers
        WHERE user_id = ${userId}
          AND deleted_at IS NULL
          AND to_char(created_at AT TIME ZONE ${timezone}, 'YYYY-MM') = ${month}
        GROUP BY day
        ORDER BY day ASC
      `)
    ).rows as unknown as { day: string; count: number }[]

    return {
      paperCount: Number(counts?.paper_count ?? 0),
      topicCount: Number(counts?.topic_count ?? 0),
      resolvedCount: Number(counts?.resolved_count ?? 0),
      days: dayRows.map((row) => ({ date: row.day, count: Number(row.count) })),
    }
  }
}
