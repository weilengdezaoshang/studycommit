import { oc } from '@orpc/contract'
import { z } from 'zod'

/**
 * 积分账户契约:普通用户只能查询自己的余额与流水。
 * 流水为追加式账目;没有面向用户的余额修改接口。
 */

export const creditBalanceSchema = z.object({
  available: z.number().int().min(0),
  reserved: z.number().int().min(0),
  /** 即将到期批次,按到期时间升序。 */
  expiring: z.array(
    z.object({
      amount: z.number().int().min(1),
      expiresAt: z.iso.datetime({ offset: true }),
    }),
  ),
  serverNow: z.iso.datetime({ offset: true }),
})
export type CreditBalance = z.infer<typeof creditBalanceSchema>

export const creditsBalanceOutputSchema = creditBalanceSchema

export const creditsLedgerEntrySchema = z.object({
  eventId: z.string(),
  kind: z.enum(['grant', 'reserve', 'settle', 'release', 'expire']),
  deltaAvailable: z.number().int(),
  deltaReserved: z.number().int(),
  grantId: z.uuid().nullable(),
  reservationId: z.uuid().nullable(),
  runId: z.uuid().nullable(),
  campaignId: z.uuid().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})
export type CreditsLedgerEntry = z.infer<typeof creditsLedgerEntrySchema>

export const creditsLedgerInputSchema = z.object({
  /** 上一页返回的游标;null 表示从头开始。 */
  cursor: z.string().max(200).nullable().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

export const creditsLedgerOutputSchema = z.object({
  items: z.array(creditsLedgerEntrySchema),
  nextCursor: z.string().nullable(),
})
export type CreditsLedgerOutput = z.infer<typeof creditsLedgerOutputSchema>

export const creditsContract = {
  balance: oc
    .route({ method: 'GET', path: '/credits/balance', summary: '查询自己的积分余额' })
    .output(creditsBalanceOutputSchema),
  ledger: oc
    .route({ method: 'GET', path: '/credits/ledger', summary: '分页查询自己的积分流水' })
    .input(creditsLedgerInputSchema)
    .output(creditsLedgerOutputSchema),
}
