import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { templates } from '../database/schema'

export type Template = typeof templates.$inferSelect

@Injectable()
export class TemplatesRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  list(userId: string) {
    return this.database.db
      .select()
      .from(templates)
      .where(
        and(
          isNull(templates.deletedAt),
          or(isNull(templates.userId), eq(templates.userId, userId)),
        ),
      )
      .orderBy(asc(templates.createdAt), asc(templates.id))
  }
}
