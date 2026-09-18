import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { CAMPAIGN_ERROR, type CampaignErrorCode } from './campaigns.constants'

const CODE_STATUS: Record<string, number> = {
  CAMPAIGN_NOT_FOUND: 404,
  CAMPAIGN_VERSION_CONFLICT: 409,
  CAMPAIGN_NOT_STARTED: 409,
  CAMPAIGN_PAUSED: 409,
  CAMPAIGN_ENDED: 409,
  CAMPAIGN_BUDGET_EXHAUSTED: 409,
  CAMPAIGN_CLAIM_LIMIT_REACHED: 409,
  CAMPAIGN_ALREADY_CLAIMED: 409,
  CAMPAIGN_INELIGIBLE: 403,
  IDEMPOTENCY_KEY_REUSED: 409,
  CAMPAIGN_NOT_CLAIMABLE: 400,
  CAMPAIGN_DRAFT_INVALID: 400,
  CAMPAIGN_CODE_TAKEN: 409,
  CAMPAIGN_INVALID_TRANSITION: 409,
  CAMPAIGN_CLAIM_NOT_PENDING: 409,
}

/** 把领域错误码映射为带语义 code 的 HTTP 异常;oRPC 层会原样透传给客户端。 */
export function campaignErrorOrThrow(code: CampaignErrorCode): never {
  const status = CODE_STATUS[code] ?? 400
  const payload = {
    code,
    message:
      (CAMPAIGN_ERROR as Record<string, { message: string } | undefined>)[code]?.message ?? code,
  }
  if (status === 404) {
throw new NotFoundException(payload)
}
  if (status === 403) {
throw new ForbiddenException(payload)
}
  if (status === 409) {
throw new ConflictException(payload)
}
  throw new BadRequestException(payload)
}
