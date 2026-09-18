import { Tag } from 'antd'
import type {
  AiProviderDisplayStatus,
  CampaignClaimStatus,
  CampaignDisplayStatus,
  CampaignStatus,
  GrantStatus,
  LedgerKind,
  ReservationStatus,
  RunStatus,
} from '@/services/types'

const CAMPAIGN_STATUS: Record<CampaignStatus, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  published: { color: 'success', text: '已发布' },
  paused: { color: 'warning', text: '已暂停' },
  ended: { color: 'error', text: '已结束' },
}

const DISPLAY_STATUS: Record<CampaignDisplayStatus, { color: string; text: string }> = {
  not_started: { color: 'default', text: '未开始' },
  active: { color: 'success', text: '进行中' },
  paused: { color: 'warning', text: '已暂停' },
  ended: { color: 'default', text: '已结束' },
  exhausted: { color: 'warning', text: '已领完' },
}

const RUN_STATUS: Record<RunStatus, { color: string; text: string }> = {
  pending: { color: 'processing', text: '运行中' },
  completed: { color: 'success', text: '运行成功' },
  failed: { color: 'error', text: '运行失败' },
}

const RESERVATION_STATUS: Record<ReservationStatus, { color: string; text: string }> = {
  active: { color: 'warning', text: '冻结中' },
  settled: { color: 'success', text: '已结算' },
  released: { color: 'blue', text: '已释放' },
  expired: { color: 'error', text: '已过期' },
}

const CLAIM_STATUS: Record<CampaignClaimStatus, { color: string; text: string }> = {
  granted: { color: 'success', text: '已发放' },
  pending_compensation: { color: 'warning', text: '待补偿' },
}

const GRANT_STATUS: Record<GrantStatus, { color: string; text: string }> = {
  active: { color: 'success', text: '生效中' },
  expired: { color: 'default', text: '已到期' },
}

const LEDGER_KIND: Record<LedgerKind, { color: string; text: string }> = {
  grant: { color: 'success', text: '发放' },
  reserve: { color: 'warning', text: '冻结' },
  settle: { color: 'blue', text: '结算' },
  release: { color: 'blue', text: '释放' },
  expire: { color: 'default', text: '到期' },
}

const PROVIDER_STATUS: Record<AiProviderDisplayStatus, { color: string; text: string }> = {
  unconfigured: { color: 'default', text: '未配置' },
  configured_unverified: { color: 'warning', text: '已配置但未验证' },
  connected: { color: 'success', text: '连接成功' },
  connection_failed: { color: 'error', text: '连接失败' },
  disabled: { color: 'error', text: '已停用' },
}

const CAMPAIGN_TYPE = {
  limited_claim: '限时领取',
  registration_bonus: '注册奖励',
} as const

function render(map: Record<string, { color: string; text: string }>, value: string) {
  const item = map[value] ?? { color: 'default', text: value }
  return <Tag color={item.color}>{item.text}</Tag>
}

export function CampaignStatusTag({ value }: { value: CampaignStatus }) {
  return render(CAMPAIGN_STATUS, value)
}

export function DisplayStatusTag({ value }: { value: CampaignDisplayStatus | null | undefined }) {
  if (!value) {
return <span>—</span>
}
  return render(DISPLAY_STATUS, value)
}

export function RunStatusTag({ value }: { value: RunStatus }) {
  return render(RUN_STATUS, value)
}

export function ReservationStatusTag({ value }: { value: ReservationStatus }) {
  return render(RESERVATION_STATUS, value)
}

export function ClaimStatusTag({ value }: { value: CampaignClaimStatus }) {
  return render(CLAIM_STATUS, value)
}

export function GrantStatusTag({ value }: { value: GrantStatus }) {
  return render(GRANT_STATUS, value)
}

export function LedgerKindTag({ value }: { value: LedgerKind }) {
  return render(LEDGER_KIND, value)
}

export function ProviderStatusTag({ value }: { value: AiProviderDisplayStatus }) {
  return render(PROVIDER_STATUS, value)
}

export function campaignTypeLabel(type: keyof typeof CAMPAIGN_TYPE) {
  return CAMPAIGN_TYPE[type]
}
