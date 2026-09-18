import { describe, expect, it, vi } from 'vitest'
import { findClaimAcrossCursors } from './find-claim'
import type { CampaignClaim } from '@/services/types'

function claim(
  id: string,
  status: CampaignClaim['status'] = 'pending_compensation',
): CampaignClaim {
  return {
    claimId: id,
    userId: '22222222-2222-4222-8222-222222222222',
    version: 1,
    status,
    grantedCredits: null,
    idempotencyKey: null,
    createdAt: '2026-09-18T00:00:00+08:00',
  }
}

describe('findClaimAcrossCursors', () => {
  it('会翻页查找原始领取，不编造详情接口', async () => {
    const listClaims = vi
      .fn()
      .mockResolvedValueOnce({ items: [claim('aaaa')], nextCursor: 'c2' })
      .mockResolvedValueOnce({
        items: [claim('44444444-4444-4444-8444-444444444444', 'granted')],
        nextCursor: null,
      })
    const result = await findClaimAcrossCursors(
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      listClaims,
    )
    expect(listClaims).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      status: 'found',
      claim: expect.objectContaining({ status: 'granted' }),
    })
  })

  it('扫完全部游标仍未找到时 exhausted 为 true', async () => {
    const listClaims = vi.fn().mockResolvedValue({ items: [claim('other')], nextCursor: null })
    const result = await findClaimAcrossCursors('cid', 'missing', listClaims)
    expect(result).toEqual({ status: 'missing', exhausted: true })
  })
})
