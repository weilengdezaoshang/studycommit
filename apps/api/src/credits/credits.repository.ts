import { Inject, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, gt, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm'
import { DatabaseService } from '../database/database.service'
import {
  creditAccounts,
  creditAllocations,
  creditGrants,
  creditLedger,
  creditReservations,
} from '../database/schema'

export type DbTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0]
export type CreditGrantRow = typeof creditGrants.$inferSelect
export type CreditReservationRow = typeof creditReservations.$inferSelect
export type CreditAccountRow = typeof creditAccounts.$inferSelect
export type CreditLedgerRow = typeof creditLedger.$inferSelect

export interface LedgerEventInput {
  eventId: string
  userId: string
  kind: CreditLedgerRow['kind']
  deltaAvailable: number
  deltaReserved: number
  balanceAvailableAfter: number
  balanceReservedAfter: number
  grantId?: string | null
  reservationId?: string | null
  runId?: string | null
  campaignId?: string | null
  claimId?: string | null
}

/** 积分表 SQL 汇集;余额变化必须与流水同事务提交,任何余额更新都走本仓库。 */
@Injectable()
export class CreditsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  /** 事务入口:服务层统一经由此方法开启事务,避免直接触碰 database。 */
  transaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.database.db.transaction(work)
  }

  /** 数据库时间是账务唯一时钟。 */
  async nowInTx(tx: DbTransaction): Promise<Date> {
    const result = await tx.execute<{ now: string }>(sql`select now()::text as now`)
    return new Date(result.rows[0].now)
  }

  /** 锁定账户行;不存在时创建(发放路径)或返回 null(纯消费路径)。 */
  async lockAccountInTx(tx: DbTransaction, userId: string, createIfMissing: boolean) {
    if (createIfMissing) {
      await tx
        .insert(creditAccounts)
        .values({ userId })
        .onConflictDoNothing({ target: creditAccounts.userId })
    }
    const [account] = await tx
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId))
      .for('update')
    return account ?? null
  }

  async insertGrantInTx(
    tx: DbTransaction,
    input: {
      userId: string
      source: CreditGrantRow['source']
      campaignId?: string | null
      claimId?: string | null
      amount: number
      expiresAt: Date | null
    },
  ): Promise<CreditGrantRow> {
    const [grant] = await tx
      .insert(creditGrants)
      .values({
        userId: input.userId,
        source: input.source,
        campaignId: input.campaignId ?? null,
        claimId: input.claimId ?? null,
        originalAmount: input.amount,
        remainingAvailable: input.amount,
        expiresAt: input.expiresAt,
      })
      .returning()
    return grant
  }

  async insertLedgerInTx(tx: DbTransaction, event: LedgerEventInput) {
    await tx.insert(creditLedger).values({
      eventId: event.eventId,
      userId: event.userId,
      kind: event.kind,
      deltaAvailable: event.deltaAvailable,
      deltaReserved: event.deltaReserved,
      balanceAvailableAfter: event.balanceAvailableAfter,
      balanceReservedAfter: event.balanceReservedAfter,
      grantId: event.grantId ?? null,
      reservationId: event.reservationId ?? null,
      runId: event.runId ?? null,
      campaignId: event.campaignId ?? null,
      claimId: event.claimId ?? null,
    })
  }

  async adjustAccountInTx(
    tx: DbTransaction,
    userId: string,
    delta: { available?: number; reserved?: number; lifetimeGranted?: number },
  ) {
    await tx
      .update(creditAccounts)
      .set({
        available: sql`${creditAccounts.available} + ${delta.available ?? 0}`,
        reserved: sql`${creditAccounts.reserved} + ${delta.reserved ?? 0}`,
        lifetimeGranted: sql`${creditAccounts.lifetimeGranted} + ${delta.lifetimeGranted ?? 0}`,
        updatedAt: new Date(),
      })
      .where(eq(creditAccounts.userId, userId))
  }

  /** 用户名下过期且仍有可用余额的批次;调用方必须在事务内持有账户锁之后执行。 */
  async lockExpiredGrantsInTx(tx: DbTransaction, userId: string, now: Date) {
    return tx
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.userId, userId),
          eq(creditGrants.status, 'active'),
          isNotNull(creditGrants.expiresAt),
          lte(creditGrants.expiresAt, now),
          gt(creditGrants.remainingAvailable, 0),
        ),
      )
      .for('update')
  }

  /**
   * FEFO 消费排序:先到期在前,无到期批次最后;id 保证稳定顺序。
   * 只取仍有可用余额的活跃批次。
   */
  async lockConsumableGrantsInTx(tx: DbTransaction, userId: string) {
    return tx
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.userId, userId),
          eq(creditGrants.status, 'active'),
          gt(creditGrants.remainingAvailable, 0),
        ),
      )
      .orderBy(sql`${creditGrants.expiresAt} asc nulls last`, asc(creditGrants.id))
      .for('update')
  }

  async freezeGrantInTx(tx: DbTransaction, grantId: string, amount: number) {
    await tx
      .update(creditGrants)
      .set({
        remainingAvailable: sql`${creditGrants.remainingAvailable} - ${amount}`,
        frozenAmount: sql`${creditGrants.frozenAmount} + ${amount}`,
      })
      .where(eq(creditGrants.id, grantId))
  }

  async insertReservationInTx(
    tx: DbTransaction,
    input: {
      userId: string
      runId: string
      amount: number
      priceVersion: number
      deadlineAt: Date
    },
  ): Promise<CreditReservationRow> {
    const [reservation] = await tx
      .insert(creditReservations)
      .values({
        userId: input.userId,
        runId: input.runId,
        amount: input.amount,
        priceVersion: input.priceVersion,
        deadlineAt: input.deadlineAt,
      })
      .returning()
    return reservation
  }

  async insertAllocationInTx(
    tx: DbTransaction,
    reservationId: string,
    grantId: string,
    amount: number,
  ) {
    await tx.insert(creditAllocations).values({ reservationId, grantId, amount })
  }

  async lockReservationInTx(tx: DbTransaction, reservationId: string) {
    const [reservation] = await tx
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.id, reservationId))
      .for('update')
    return reservation ?? null
  }

  async lockReservationByRunIdInTx(tx: DbTransaction, runId: string) {
    const [reservation] = await tx
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.runId, runId))
      .for('update')
    return reservation ?? null
  }

  async lockAllocationsWithGrantsInTx(tx: DbTransaction, reservationId: string) {
    const allocations = await tx
      .select()
      .from(creditAllocations)
      .where(eq(creditAllocations.reservationId, reservationId))
    if (allocations.length === 0) {
      return []
    }
    const grants = await tx
      .select()
      .from(creditGrants)
      .where(
        inArray(
          creditGrants.id,
          allocations.map((allocation) => allocation.grantId),
        ),
      )
      .for('update')
    const grantById = new Map(grants.map((grant) => [grant.id, grant]))
    return allocations.map((allocation) => ({
      allocation,
      grant: grantById.get(allocation.grantId)!,
    }))
  }

  /** 结算:批次冻结额直接消耗;remaining/frozen 都减去分配额由调用方拆分调用。 */
  async consumeFrozenInTx(tx: DbTransaction, grantId: string, amount: number) {
    await tx
      .update(creditGrants)
      .set({ frozenAmount: sql`${creditGrants.frozenAmount} - ${amount}` })
      .where(eq(creditGrants.id, grantId))
  }

  /** 失败释放未过期部分:冻结退回可用。 */
  async unfreezeToAvailableInTx(tx: DbTransaction, grantId: string, amount: number) {
    await tx
      .update(creditGrants)
      .set({
        frozenAmount: sql`${creditGrants.frozenAmount} - ${amount}`,
        remainingAvailable: sql`${creditGrants.remainingAvailable} + ${amount}`,
      })
      .where(eq(creditGrants.id, grantId))
  }

  /** 失败释放时已过期部分:冻结直接消失,不回到可用额。 */
  async dropExpiredFrozenInTx(tx: DbTransaction, grantId: string, amount: number) {
    await tx
      .update(creditGrants)
      .set({ frozenAmount: sql`${creditGrants.frozenAmount} - ${amount}` })
      .where(eq(creditGrants.id, grantId))
  }

  async markGrantExpiredInTx(tx: DbTransaction, grantId: string, expiredAt: Date) {
    await tx
      .update(creditGrants)
      .set({ status: 'expired', expiredAt })
      .where(eq(creditGrants.id, grantId))
  }

  /** 惰性到期:remaining 清零并置 expired;冻结额原样保留。 */
  async expireGrantRemainingInTx(tx: DbTransaction, grantId: string, expiredAt: Date) {
    await tx
      .update(creditGrants)
      .set({ remainingAvailable: 0, status: 'expired', expiredAt })
      .where(eq(creditGrants.id, grantId))
  }

  /** 清扫路径:置 expired 后清零 remaining。 */
  async clearGrantRemainingInTx(tx: DbTransaction, grantId: string) {
    await tx.update(creditGrants).set({ remainingAvailable: 0 }).where(eq(creditGrants.id, grantId))
  }

  async markReservationSettledInTx(tx: DbTransaction, reservationId: string, settledAt: Date) {
    await tx
      .update(creditReservations)
      .set({ status: 'settled', settledAt })
      .where(eq(creditReservations.id, reservationId))
  }

  async markReservationReleasedInTx(
    tx: DbTransaction,
    reservationId: string,
    status: 'released' | 'expired',
    releasedAt: Date,
  ) {
    await tx
      .update(creditReservations)
      .set({ status, releasedAt })
      .where(eq(creditReservations.id, reservationId))
  }

  /** 到期清扫候选:活跃、已到期、仍有可用余额。 */
  async lockDueGrantsForSweepInTx(tx: DbTransaction, now: Date, limit: number) {
    return tx
      .select()
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.status, 'active'),
          isNotNull(creditGrants.expiresAt),
          lte(creditGrants.expiresAt, now),
          gt(creditGrants.remainingAvailable, 0),
        ),
      )
      .orderBy(asc(creditGrants.expiresAt))
      .limit(limit)
      .for('update', { skipLocked: true })
  }

  async findAccount(userId: string) {
    const [account] = await this.database.db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId))
    return account ?? null
  }

  async findAccountInTx(tx: DbTransaction, userId: string) {
    const [account] = await tx
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId))
    return account ?? null
  }

  async findGrantById(grantId: string) {
    const [grant] = await this.database.db
      .select()
      .from(creditGrants)
      .where(eq(creditGrants.id, grantId))
    return grant ?? null
  }

  /** 即将到期批次汇总(升序,最多 3 桶),用于余额展示。 */
  async listExpiringBuckets(userId: string, now: Date) {
    const rows = await this.database.db
      .select({
        expiresAt: creditGrants.expiresAt,
        amount: sql<number>`sum(${creditGrants.remainingAvailable})::int`,
      })
      .from(creditGrants)
      .where(
        and(
          eq(creditGrants.userId, userId),
          eq(creditGrants.status, 'active'),
          isNotNull(creditGrants.expiresAt),
          gt(creditGrants.expiresAt, now),
          gt(creditGrants.remainingAvailable, 0),
        ),
      )
      .groupBy(creditGrants.expiresAt)
      .orderBy(asc(creditGrants.expiresAt))
      .limit(3)
    return rows
  }

  /** 游标分页流水:cursor 为 `${createdAt.toISOString()}|${eventId}`,时间戳参数化避免拼接。 */
  async listLedger(userId: string, cursor: string | null, limit: number) {
    let cursorFilter
    if (cursor) {
      const separator = cursor.lastIndexOf('|')
      if (separator <= 0) {
        return null
      }
      const cursorDate = new Date(cursor.slice(0, separator))
      const cursorEventId = cursor.slice(separator + 1)
      if (Number.isNaN(cursorDate.getTime()) || !cursorEventId) {
        return null
      }
      cursorFilter = sql`(${creditLedger.createdAt}, ${creditLedger.eventId}) < (${cursorDate}, ${cursorEventId})`
    }
    return this.database.db
      .select()
      .from(creditLedger)
      .where(
        cursorFilter
          ? and(eq(creditLedger.userId, userId), cursorFilter)
          : eq(creditLedger.userId, userId),
      )
      .orderBy(desc(creditLedger.createdAt), desc(creditLedger.eventId))
      .limit(limit + 1)
  }

  /** 幂等兜底:同 eventId 已写入的流水(至少一次投递时防重)。 */
  async findLedgerEvent(eventId: string) {
    const [row] = await this.database.db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.eventId, eventId))
    return row ?? null
  }

  /** 对账:账户余额与批次聚合差异检测。 */
  async accountVsGrantsDiff(userId: string) {
    const result = await this.database.db.execute<{
      available: number
      grant_available: number
      reserved: number
      grant_frozen: number
    }>(sql`
      select
        coalesce(a.available, 0)::int as available,
        coalesce(sum(g.remaining_available) filter (where g.status = 'active'), 0)::int as grant_available,
        coalesce(a.reserved, 0)::int as reserved,
        coalesce(sum(g.frozen_amount) filter (where g.status = 'active'), 0)::int as grant_frozen
      from credit_accounts a
      left join credit_grants g on g.user_id = a.user_id
      where a.user_id = ${userId}
      group by a.available, a.reserved
    `)
    const row = result.rows[0]
    if (!row) {
return null
}
    return {
      availableMismatch: row.available !== row.grant_available,
      reservedMismatch: row.reserved !== row.grant_frozen,
    }
  }

  /** 事务内重建校验:账户余额应等于流水重放结果。 */
  async replayLedgerTotals(userId: string) {
    const result = await this.database.db.execute<{
      delta_available: number
      delta_reserved: number
    }>(sql`
      select
        coalesce(sum(delta_available), 0)::int as delta_available,
        coalesce(sum(delta_reserved), 0)::int as delta_reserved
      from credit_ledger where user_id = ${userId}
    `)
    return result.rows[0]
  }

  async findActiveReservationsOlderThan(deadline: Date, limit: number) {
    return this.database.db
      .select()
      .from(creditReservations)
      .where(
        and(eq(creditReservations.status, 'active'), lte(creditReservations.deadlineAt, deadline)),
      )
      .orderBy(asc(creditReservations.deadlineAt))
      .limit(limit)
  }

  /** 测试与对账辅助:某用户当前活跃冻结笔数。 */
  async countActiveReservations(userId: string) {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(creditReservations)
      .where(and(eq(creditReservations.userId, userId), eq(creditReservations.status, 'active')))
    return rows[0]?.count ?? 0
  }

  /** 受理前校验运行存在,避免冻结事务以 FK 异常回滚。 */
  async findRunIdInTx(tx: DbTransaction, runId: string) {
    const result = await tx.execute<{ id: string }>(
      sql`select id from agent_runs where id = ${runId}`,
    )
    return result.rows[0] ?? null
  }

  async findReservationById(reservationId: string) {
    const [row] = await this.database.db
      .select()
      .from(creditReservations)
      .where(eq(creditReservations.id, reservationId))
    return row ?? null
  }

  async findReservationByRunId(runId: string) {
    const [row] = await this.database.db
      .select()
      .from(creditReservations)
      .where(and(eq(creditReservations.runId, runId), ne(creditReservations.status, 'settled')))
      .limit(1)
    return row ?? null
  }
}
