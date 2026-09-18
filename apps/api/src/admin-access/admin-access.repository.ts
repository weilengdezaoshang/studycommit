import { Inject, Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import { adminAuditLogs, adminRoles, users } from '../database/schema'
import type { AdminRole } from './admin-access.constants'

export type AdminRoleRow = typeof adminRoles.$inferSelect

@Injectable()
export class AdminAccessRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  transaction<T>(
    work: (tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]) => Promise<T>,
  ): Promise<T> {
    return this.database.db.transaction(work)
  }

  async findRoleByUserId(userId: string): Promise<AdminRole | null> {
    const [row] = await this.database.db
      .select({ role: adminRoles.role })
      .from(adminRoles)
      .where(eq(adminRoles.userId, userId))
    return (row?.role as AdminRole) ?? null
  }

  async listRoles() {
    return this.database.db
      .select({
        userId: adminRoles.userId,
        role: adminRoles.role,
        grantedBy: adminRoles.grantedBy,
        reason: adminRoles.reason,
        createdAt: adminRoles.createdAt,
      })
      .from(adminRoles)
      .orderBy(desc(adminRoles.createdAt))
  }

  async findUserById(userId: string) {
    const [row] = await this.database.db.select().from(users).where(eq(users.id, userId))
    return row ?? null
  }

  async upsertRoleInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    input: { userId: string; role: AdminRole; grantedBy: string | null; reason: string },
  ) {
    await tx
      .insert(adminRoles)
      .values({
        userId: input.userId,
        role: input.role,
        grantedBy: input.grantedBy,
        reason: input.reason,
      })
      .onConflictDoUpdate({
        target: adminRoles.userId,
        set: {
          role: input.role,
          grantedBy: input.grantedBy,
          reason: input.reason,
          updatedAt: new Date(),
        },
      })
  }

  async insertAuditLogInTx(
    tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0],
    input: {
      actorUserId: string
      action: string
      targetType: string
      targetId: string
      beforeSnapshot?: Record<string, unknown> | null
      afterSnapshot?: Record<string, unknown> | null
      reason: string
      requestId?: string | null
    },
  ) {
    await tx.insert(adminAuditLogs).values({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeSnapshot: input.beforeSnapshot ?? null,
      afterSnapshot: input.afterSnapshot ?? null,
      reason: input.reason,
      requestId: input.requestId ?? null,
    })
  }
}
