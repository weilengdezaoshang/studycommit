import type { CampaignClaim } from '@/services/types'

const PAGE_LIMIT = 100
const MAX_PAGES = 20

export type ClaimLookup =
  { status: 'found'; claim: CampaignClaim } | { status: 'missing'; exhausted: boolean }

/** 沿领取游标查找原 claim,不编造详情接口. */
export async function findClaimAcrossCursors(
  campaignId: string,
  claimId: string,
  listClaims: (params: {
    id: string
    limit?: number
    cursor?: string | null
  }) => Promise<{ items: CampaignClaim[]; nextCursor: string | null }>,
): Promise<ClaimLookup> {
  let cursor: string | null = null
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const page = await listClaims({ id: campaignId, limit: PAGE_LIMIT, cursor })
    const found = page.items.find((item) => item.claimId === claimId)
    if (found) {
return { status: 'found', claim: found }
}
    if (!page.nextCursor) {
return { status: 'missing', exhausted: true }
}
    cursor = page.nextCursor
  }
  return { status: 'missing', exhausted: false }
}
