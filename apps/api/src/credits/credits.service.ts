import { Inject, Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { randomUUID } from 'node:crypto'
import { PinoLogger } from 'nestjs-pino'
import { CreditsRepository, type DbTransaction } from './credits.repository'
import { CREDITS_ERROR, MAX_CREDIT_AMOUNT } from './credits.constants'

export interface GrantInput {
  userId: string
  amount: number
  source: 'campaign' | 'admin_grant'
  campaignId?: string | null
  claimId?: string | null
  expiresAt?: Date | null
}

export interface ReserveInput {
  userId: string
  runId: string
  amount: number
  priceVersion: number
  /** 结果对账截止时间;到期仍无结果由对账任务释放。 */
  deadlineAt: Date
}

export type ReserveResult =
  | { ok: true; reservationId: string; allocated: Array<{ grantId: string; amount: number }> }
  | {
      ok: false
      code:
        | typeof CREDITS_ERROR.insufficient.code
        | typeof CREDITS_ERROR.amountInvalid.code
        | typeof CREDITS_ERROR.accountMissing.code
        | typeof CREDITS_ERROR.runNotFound.code
    }

export type SettleResult =
  | { ok: true; settledCredits: number }
  | {
      ok: false
      code:
        | 'CREDITS_RESERVATION_NOT_FOUND'
        | 'CREDITS_ACCOUNT_MISSING'
        | 'CREDITS_RESERVATION_ALREADY_CLOSED'
      status?: string
    }

export type ReleaseResult =
  | { ok: true; restoredCredits: number; expiredCredits: number }
  | {
      ok: false
      code:
        | 'CREDITS_RESERVATION_NOT_FOUND'
        | 'CREDITS_ACCOUNT_MISSING'
        | 'CREDITS_RESERVATION_ALREADY_CLOSED'
      status?: string
    }

export interface BalanceSnapshot {
  available: number
  reserved: number
  expiring: Array<{ amount: number; expiresAt: Date }>
}

const EXPIRE_SWEEP_BATCH = 200

/**
 * 积分账务唯一写入口。
 * 不变量:account.available = 活跃批次可用额之和;reserved = 活跃冻结分配之和;
 * 一切余额变化与 credit_ledger 同事务提交;ledger 追加式只写。
 */
@Injectable()
export class CreditsService {
  constructor(
    @Inject(CreditsRepository) private readonly repository: CreditsRepository,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreditsService.name)
  }

  /** 在外部事务内发放(如领取事务);调用方负责账户锁与预算校验。 */
  async grantInTx(tx: DbTransaction, input: GrantInput) {
    if (
      !Number.isSafeInteger(input.amount) ||
      input.amount < 1 ||
      input.amount > MAX_CREDIT_AMOUNT
    ) {
      return { ok: false as const, code: CREDITS_ERROR.amountInvalid.code }
    }
    await this.expireGrantsForUserInTx(tx, input.userId)
    const account = await this.repository.lockAccountInTx(tx, input.userId, true)
    if (!account) {
      return { ok: false as const, code: CREDITS_ERROR.accountMissing.code }
    }
    const grant = await this.repository.insertGrantInTx(tx, {
      userId: input.userId,
      source: input.source,
      campaignId: input.campaignId ?? null,
      claimId: input.claimId ?? null,
      amount: input.amount,
      expiresAt: input.expiresAt ?? null,
    })
    const availableAfter = account.available + input.amount
    await this.repository.adjustAccountInTx(tx, input.userId, {
      available: input.amount,
      lifetimeGranted: input.amount,
    })
    await this.repository.insertLedgerInTx(tx, {
      eventId: randomUUID(),
      userId: input.userId,
      kind: 'grant',
      deltaAvailable: input.amount,
      deltaReserved: 0,
      balanceAvailableAfter: availableAfter,
      balanceReservedAfter: account.reserved,
      grantId: grant.id,
      campaignId: input.campaignId ?? null,
      claimId: input.claimId ?? null,
    })
    return { ok: true as const, grant }
  }

  /**
   * 冻结:短事务内锁定账户并按先到期先使用分配批次。
   * 调用方必须已创建 agent_runs 行(runId 外键)。
   */
  async reserve(input: ReserveInput): Promise<ReserveResult> {
    if (
      !Number.isSafeInteger(input.amount) ||
      input.amount < 1 ||
      input.amount > MAX_CREDIT_AMOUNT
    ) {
      return { ok: false, code: CREDITS_ERROR.amountInvalid.code }
    }
    return this.repository.transaction(async (tx) => this.reserveInTx(tx, input))
  }

  /** 事务内冻结:受理短事务(开关/预算/冻结/运行创建同事务)复用。 */
  async reserveInTx(tx: DbTransaction, input: ReserveInput): Promise<ReserveResult> {
    {
      const run = await this.repository.findRunIdInTx(tx, input.runId)
      if (!run) {
        return { ok: false, code: CREDITS_ERROR.runNotFound.code }
      }
      await this.expireGrantsForUserInTx(tx, input.userId)
      const account = await this.repository.lockAccountInTx(tx, input.userId, false)
      if (!account || account.available < input.amount) {
        return { ok: false, code: CREDITS_ERROR.insufficient.code }
      }
      const grants = await this.repository.lockConsumableGrantsInTx(tx, input.userId)
      const allocations: Array<{ grantId: string; amount: number }> = []
      let remaining = input.amount
      for (const grant of grants) {
        if (remaining <= 0) {
break
}
        const take = Math.min(grant.remainingAvailable, remaining)
        if (take <= 0) {
continue
}
        await this.repository.freezeGrantInTx(tx, grant.id, take)
        allocations.push({ grantId: grant.id, amount: take })
        remaining -= take
      }
      if (remaining > 0) {
        // 理论上被 available 校验兜底;防御批次与账户失衡时拒绝而不是错账。
        return { ok: false, code: CREDITS_ERROR.insufficient.code }
      }
      const reservation = await this.repository.insertReservationInTx(tx, {
        userId: input.userId,
        runId: input.runId,
        amount: input.amount,
        priceVersion: input.priceVersion,
        deadlineAt: input.deadlineAt,
      })
      for (const allocation of allocations) {
        await this.repository.insertAllocationInTx(
          tx,
          reservation.id,
          allocation.grantId,
          allocation.amount,
        )
      }
      await this.repository.adjustAccountInTx(tx, input.userId, {
        available: -input.amount,
        reserved: input.amount,
      })
      await this.repository.insertLedgerInTx(tx, {
        eventId: randomUUID(),
        userId: input.userId,
        kind: 'reserve',
        deltaAvailable: -input.amount,
        deltaReserved: input.amount,
        balanceAvailableAfter: account.available - input.amount,
        balanceReservedAfter: account.reserved + input.amount,
        reservationId: reservation.id,
        runId: input.runId,
      })
      return { ok: true, reservationId: reservation.id, allocated: allocations }
    }
  }

  /**
   * 结算:消耗原冻结额(即使批次在冻结期间到期,成功结果仍按冻结额扣)。
   * 重复调用幂等:已关闭的冻结返回当前状态,不再次改变余额。
   */
  async settle(reservationId: string): Promise<SettleResult> {
    return this.repository.transaction(async (tx) => this.settleInTx(tx, reservationId))
  }

  /** 事务内结算:与结果持久化同事务提交。 */
  async settleInTx(tx: DbTransaction, reservationId: string): Promise<SettleResult> {
    {
      const reservation = await this.repository.lockReservationInTx(tx, reservationId)
      if (!reservation) {
        return { ok: false, code: CREDITS_ERROR.reservationNotFound.code }
      }
      if (reservation.status !== 'active') {
        return { ok: false, code: 'CREDITS_RESERVATION_ALREADY_CLOSED', status: reservation.status }
      }
      const pairs = await this.repository.lockAllocationsWithGrantsInTx(tx, reservation.id)
      const account = await this.repository.lockAccountInTx(tx, reservation.userId, false)
      if (!account) {
        return { ok: false, code: CREDITS_ERROR.accountMissing.code }
      }
      for (const { allocation, grant } of pairs) {
        await this.repository.consumeFrozenInTx(tx, grant.id, allocation.amount)
      }
      await this.repository.adjustAccountInTx(tx, reservation.userId, {
        reserved: -reservation.amount,
      })
      await this.repository.markReservationSettledInTx(tx, reservation.id, new Date())
      await this.repository.insertLedgerInTx(tx, {
        eventId: randomUUID(),
        userId: reservation.userId,
        kind: 'settle',
        deltaAvailable: 0,
        deltaReserved: -reservation.amount,
        balanceAvailableAfter: account.available,
        balanceReservedAfter: account.reserved - reservation.amount,
        reservationId: reservation.id,
        runId: reservation.runId,
      })
      return { ok: true, settledCredits: reservation.amount }
    }
  }

  /**
   * 释放:失败/超时路径。未过期部分退回可用;已过期部分进入 expire 流水,不复活。
   * 重复调用幂等。
   */
  async release(reservationId: string): Promise<ReleaseResult> {
    return this.repository.transaction(async (tx) => this.releaseInTx(tx, reservationId))
  }

  /** 事务内释放:与运行终态化同事务提交。 */
  async releaseInTx(tx: DbTransaction, reservationId: string): Promise<ReleaseResult> {
    {
      const reservation = await this.repository.lockReservationInTx(tx, reservationId)
      if (!reservation) {
        return { ok: false, code: CREDITS_ERROR.reservationNotFound.code }
      }
      if (reservation.status !== 'active') {
        return { ok: false, code: 'CREDITS_RESERVATION_ALREADY_CLOSED', status: reservation.status }
      }
      const now = await this.repository.nowInTx(tx)
      const pairs = await this.repository.lockAllocationsWithGrantsInTx(tx, reservation.id)
      const account = await this.repository.lockAccountInTx(tx, reservation.userId, false)
      if (!account) {
        return { ok: false, code: CREDITS_ERROR.accountMissing.code }
      }
      let restored = 0
      let expired = 0
      for (const { allocation, grant } of pairs) {
        const isExpired = grant.expiresAt !== null && grant.expiresAt.getTime() <= now.getTime()
        if (isExpired) {
          await this.repository.dropExpiredFrozenInTx(tx, grant.id, allocation.amount)
          expired += allocation.amount
        } else {
          await this.repository.unfreezeToAvailableInTx(tx, grant.id, allocation.amount)
          restored += allocation.amount
        }
      }
      await this.repository.adjustAccountInTx(tx, reservation.userId, {
        available: restored,
        reserved: -reservation.amount,
      })
      await this.repository.markReservationReleasedInTx(tx, reservation.id, 'released', new Date())
      if (expired > 0) {
        await this.repository.insertLedgerInTx(tx, {
          eventId: randomUUID(),
          userId: reservation.userId,
          kind: 'expire',
          deltaAvailable: 0,
          deltaReserved: -expired,
          balanceAvailableAfter: account.available,
          balanceReservedAfter: account.reserved - restored - expired,
          reservationId: reservation.id,
          runId: reservation.runId,
        })
      }
      if (restored > 0) {
        await this.repository.insertLedgerInTx(tx, {
          eventId: randomUUID(),
          userId: reservation.userId,
          kind: 'release',
          deltaAvailable: restored,
          deltaReserved: -restored,
          balanceAvailableAfter: account.available + restored,
          balanceReservedAfter: account.reserved - restored - expired,
          reservationId: reservation.id,
          runId: reservation.runId,
        })
      }
      return { ok: true, restoredCredits: restored, expiredCredits: expired }
    }
  }

  /** 惰性到期:任何余额读/写前处理过期未冻结额,清扫 Worker 延迟也不能消费过期积分。 */
  private async expireGrantsForUserInTx(tx: DbTransaction, userId: string) {
    const now = await this.repository.nowInTx(tx)
    const grants = await this.repository.lockExpiredGrantsInTx(tx, userId, now)
    if (grants.length === 0) {
      return 0
    }
    const account = await this.repository.lockAccountInTx(tx, userId, false)
    if (!account) {
      return 0
    }
    let expiredTotal = 0
    for (const grant of grants) {
      const amount = grant.remainingAvailable
      if (amount <= 0) {
continue
}
      // remaining 清零并置 expired;冻结额(若有)原样保留,等结算/释放按规则处理。
      await this.repository.expireGrantRemainingInTx(tx, grant.id, now)
      expiredTotal += amount
      await this.repository.insertLedgerInTx(tx, {
        eventId: randomUUID(),
        userId,
        kind: 'expire',
        deltaAvailable: -amount,
        deltaReserved: 0,
        balanceAvailableAfter: account.available - expiredTotal,
        balanceReservedAfter: account.reserved,
        grantId: grant.id,
      })
    }
    if (expiredTotal > 0) {
      await this.repository.adjustAccountInTx(tx, userId, { available: -expiredTotal })
    }
    return expiredTotal
  }

  /** 定时清扫:处理不活跃用户的到期批次(惰性路径只覆盖有流量的用户)。 */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepExpired(): Promise<number> {
    let total = 0
    // 逐批处理直到没有候选;单批一个事务,失败只影响当批。
    for (let round = 0; round < 10; round += 1) {
      const processed = await this.repository.transaction(async (tx) => {
        const grants = await this.repository.lockDueGrantsForSweepInTx(
          tx,
          new Date(),
          EXPIRE_SWEEP_BATCH,
        )
        if (grants.length === 0) {
return 0
}
        const byUser = new Map<string, number>()
        for (const grant of grants) {
          const amount = grant.remainingAvailable
          await this.repository.markGrantExpiredInTx(tx, grant.id, grant.expiresAt as Date)
          await this.repository.clearGrantRemainingInTx(tx, grant.id)
          byUser.set(grant.userId, (byUser.get(grant.userId) ?? 0) + amount)
        }
        for (const [userId, amount] of byUser) {
          const account = await this.repository.lockAccountInTx(tx, userId, false)
          if (!account) {
continue
}
          await this.repository.adjustAccountInTx(tx, userId, { available: -amount })
          await this.repository.insertLedgerInTx(tx, {
            eventId: randomUUID(),
            userId,
            kind: 'expire',
            deltaAvailable: -amount,
            deltaReserved: 0,
            balanceAvailableAfter: account.available - amount,
            balanceReservedAfter: account.reserved,
          })
        }
        return grants.length
      })
      total += processed
      if (processed < EXPIRE_SWEEP_BATCH) {
break
}
    }
    if (total > 0) {
      this.logger.info({ total }, '到期积分已清扫')
    }
    return total
  }

  /** 游标分页流水:只允许查询自己的账目。 */
  async listLedger(userId: string, cursor: string | null, limit: number) {
    const rows = (await this.repository.listLedger(userId, cursor, limit)) ?? []
    const hasNext = rows.length > limit
    const items = rows.slice(0, limit).map((row) => ({
      eventId: row.eventId,
      kind: row.kind,
      deltaAvailable: row.deltaAvailable,
      deltaReserved: row.deltaReserved,
      grantId: row.grantId,
      reservationId: row.reservationId,
      runId: row.runId,
      campaignId: row.campaignId,
      createdAt: row.createdAt.toISOString(),
    }))
    const last = rows[limit - 1]
    return {
      items,
      nextCursor: hasNext && last ? `${last.createdAt.toISOString()}|${last.eventId}` : null,
    }
  }

  /** 余额查询:先惰性到期再读权威账户。 */
  async getBalance(userId: string): Promise<BalanceSnapshot> {
    await this.repository.transaction(async (tx) => {
      await this.expireGrantsForUserInTx(tx, userId)
    })
    const account = await this.repository.findAccount(userId)
    const expiring = await this.repository.listExpiringBuckets(userId, new Date())
    return {
      available: account?.available ?? 0,
      reserved: account?.reserved ?? 0,
      expiring: expiring
        .filter((row) => row.expiresAt !== null)
        .map((row) => ({ amount: Number(row.amount), expiresAt: row.expiresAt as Date })),
    }
  }
}
