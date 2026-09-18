import type {
  AiPrice,
  AiProviderConfig,
  AiServiceConfig,
  CampaignDraftConfig,
} from '@/services/types'

function canonical(value: unknown, key = ''): unknown {
  if (value === null || value === undefined) {
return value
}
  if (typeof value === 'string') {
    if (['startsAt', 'endsAt', 'fixedExpiresAt', 'verifiedFrom', 'verifiedTo'].includes(key)) {
      const timestamp = Date.parse(value)
      return Number.isNaN(timestamp) ? value : timestamp
    }
    if (['dailyCostBudget', 'estimatedCostPerRun'].includes(key)) {
      const [whole, fraction = ''] = value.split('.')
      return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.replace(/0+$/, '')}`
    }
    return value
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => canonical(item))
    return key === 'platforms' || key === 'providers' ? items.sort() : items
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, item]) => [name, canonical(item, name)]),
    )
  }
  return value
}

/** 核对实际保存内容，不能将其他管理员造成的版本变化视为本次写入成功。 */
export function sameDraftConfig(
  actual: CampaignDraftConfig | null,
  expected: CampaignDraftConfig,
): boolean {
  return (
    actual !== null && JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected))
  )
}

export type ConfigPatch = Partial<
  Pick<AiServiceConfig, 'aiEnabled' | 'featureFlags' | 'costProtectionEnabled' | 'dailyCostBudget'>
>
export function matchesConfigPatch(actual: AiServiceConfig, expected: ConfigPatch): boolean {
  return Object.entries(expected).every(
    ([key, value]) =>
      JSON.stringify(canonical(actual[key as keyof ConfigPatch], key)) ===
      JSON.stringify(canonical(value, key)),
  )
}

export function matchesProviderConfig(
  actual: AiProviderConfig,
  expected: Pick<AiProviderConfig, 'protocol' | 'baseUrl' | 'model' | 'displayStatus'>,
): boolean {
  return (
    actual.protocol === expected.protocol &&
    actual.baseUrl === expected.baseUrl &&
    actual.model === expected.model &&
    actual.displayStatus === expected.displayStatus
  )
}

export function matchesPrice(
  actual: AiPrice,
  expected: Pick<AiPrice, 'action' | 'priceCredits' | 'configSnapshot'>,
): boolean {
  return (
    actual.action === expected.action &&
    actual.priceCredits === expected.priceCredits &&
    JSON.stringify(canonical(actual.configSnapshot)) ===
      JSON.stringify(canonical(expected.configSnapshot))
  )
}
