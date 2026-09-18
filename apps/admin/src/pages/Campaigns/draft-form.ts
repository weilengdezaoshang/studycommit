import type { Dayjs } from 'dayjs'
import type {
  CampaignDraftConfig,
  CampaignEligibility,
  CampaignPlatform,
  CampaignType,
} from '@/services/types'
import { DISPLAY_TIMEZONE } from '@/utils/format'
import { isIntegerInRange, parseShanghai, toShanghaiIso } from '@/utils/shanghai-time'
import { validateReason } from '@/utils/reason'

const DEFAULT_ELIGIBILITY: CampaignEligibility = {
  verifiedFrom: null,
  verifiedTo: null,
  providers: null,
  requireActiveAccount: true,
}

export interface DraftFormValues {
  code: string
  type: CampaignType
  name?: string
  startsAt: Dayjs
  endsAt: Dayjs
  grantCredits: number
  validityMode: 'days' | 'fixed'
  creditValidityDays?: number | null
  fixedExpiresAt?: Dayjs | null
  perUserLimit: number
  totalBudgetCredits?: number | null
  totalClaimLimit?: number | null
  title: string
  description: string
  successMessage: string
  platforms: CampaignPlatform[]
  eligibility?: CampaignEligibility
  reason: string
}

export const CODE_PATTERN = /^[a-z0-9-]+$/

export function emptyDraftValues(): Partial<DraftFormValues> {
  return {
    type: 'limited_claim',
    perUserLimit: 1,
    validityMode: 'days',
    platforms: ['desktop', 'mobile'],
  }
}

export function valuesFromConfig(
  config: CampaignDraftConfig,
  extras?: Partial<
    Pick<DraftFormValues, 'code' | 'type' | 'totalBudgetCredits' | 'totalClaimLimit'>
  >,
): DraftFormValues {
  return {
    code: extras?.code ?? '',
    type: extras?.type ?? 'limited_claim',
    name: config.name,
    eligibility: config.eligibility,
    startsAt: parseShanghai(config.startsAt),
    endsAt: parseShanghai(config.endsAt),
    grantCredits: config.grantCredits,
    validityMode: config.fixedExpiresAt ? 'fixed' : 'days',
    creditValidityDays: config.creditValidityDays,
    fixedExpiresAt: config.fixedExpiresAt ? parseShanghai(config.fixedExpiresAt) : null,
    perUserLimit: config.perUserLimit,
    totalBudgetCredits: extras?.totalBudgetCredits ?? null,
    totalClaimLimit: extras?.totalClaimLimit ?? null,
    title: config.copy.title,
    description: config.copy.description,
    successMessage: config.copy.successMessage,
    platforms: config.platforms,
    reason: '',
  }
}

export function buildDraftConfig(values: DraftFormValues): CampaignDraftConfig {
  return {
    name: (values.name ?? values.title).trim(),
    grantCredits: values.grantCredits,
    creditValidityDays: values.validityMode === 'days' ? Number(values.creditValidityDays) : null,
    fixedExpiresAt:
      values.validityMode === 'fixed' && values.fixedExpiresAt
        ? toShanghaiIso(values.fixedExpiresAt)
        : null,
    perUserLimit: values.perUserLimit,
    startsAt: toShanghaiIso(values.startsAt),
    endsAt: toShanghaiIso(values.endsAt),
    platforms: values.platforms,
    eligibility: values.eligibility ?? DEFAULT_ELIGIBILITY,
    copy: {
      title: values.title.trim(),
      description: values.description.trim(),
      successMessage: values.successMessage.trim(),
    },
  }
}

/** 编辑保存必须显式合并原草稿的内部 name 与 eligibility,不能依赖未注册 Form 字段. */
export function mergeEditConfig(
  base: CampaignDraftConfig,
  values: DraftFormValues,
): CampaignDraftConfig {
  const next = buildDraftConfig(values)
  return {
    ...next,
    name: base.name,
    eligibility: base.eligibility,
  }
}

export function validateDraftForm(values: Partial<DraftFormValues>, mode: 'create' | 'edit') {
  const errors: Partial<Record<keyof DraftFormValues, string>> = {}
  if (mode === 'create') {
    const code = values.code?.trim() ?? ''
    if (!code) {
errors.code = '请填写活动 code'
} else if (!CODE_PATTERN.test(code) || code.length < 2 || code.length > 64) {
      errors.code = '仅允许小写字母、数字与连字符，长度 2–64'
    }
    if (!values.type) {
errors.type = '请选择活动类型'
}
  }
  if (!values.startsAt || !values.endsAt) {
errors.startsAt = '请选择领取窗口'
} else if (!values.startsAt.isBefore(values.endsAt)) {
errors.endsAt = '结束时间必须晚于开始时间'
}
  if (!isIntegerInRange(values.grantCredits, 1, 1_000_000_000)) {
    errors.grantCredits = '发放积分须为 1 到 1000000000 的整数'
  }
  if (values.validityMode === 'days') {
    if (!isIntegerInRange(values.creditValidityDays, 1, 3650)) {
      errors.creditValidityDays = '有效天数须为 1 到 3650 的整数'
    }
  } else if (!values.fixedExpiresAt) {
    errors.fixedExpiresAt = '请选择固定截止时刻'
  } else if (values.endsAt && values.fixedExpiresAt.isBefore(values.endsAt)) {
    errors.fixedExpiresAt = '固定截止时刻不能早于领取窗口结束'
  }
  if (!isIntegerInRange(values.perUserLimit, 1, 100)) {
errors.perUserLimit = '每人限领须为 1 到 100 的整数'
}
  if (values.totalBudgetCredits !== null && values.totalBudgetCredits !== undefined) {
    if (!isIntegerInRange(values.totalBudgetCredits, 0, 1_000_000_000)) {
      errors.totalBudgetCredits = '总预算须为不小于 0 的整数，或留空表示不限'
    }
  }
  if (values.totalClaimLimit !== null && values.totalClaimLimit !== undefined) {
    if (!isIntegerInRange(values.totalClaimLimit, 0, 1_000_000)) {
      errors.totalClaimLimit = '总领取上限须为不小于 0 的整数，或留空表示不限'
    }
  }
  if (!values.title?.trim()) {
errors.title = '请填写展示标题'
}
  if (!values.description?.trim()) {
errors.description = '请填写展示描述'
}
  if (!values.successMessage?.trim()) {
errors.successMessage = '请填写成功文案'
}
  if (!values.platforms?.length) {
errors.platforms = '至少选择一个展示平台'
}
  const reasonError = validateReason(values.reason ?? '')
  if (reasonError) {
errors.reason = reasonError
}
  return errors
}

export function optionalLimit(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
return null
}
  return Number(value)
}

export const timezone = DISPLAY_TIMEZONE
