import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { BadRequestException } from '@nestjs/common'
import { AI_PROTOCOL_DEFAULT_BASE_URL, type AiProtocol } from './ai-provider'

export const AI_PROVIDER_ENDPOINT_ERROR = {
  invalid: { code: 'AI_PROVIDER_URL_INVALID', message: '接口地址无效' },
  unsafe: { code: 'AI_PROVIDER_URL_UNSAFE', message: '接口地址不受支持' },
} as const

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'metadata.azure.com',
  'instance-data',
])

export type LookupFn = (hostname: string) => Promise<Array<{ address: string }>>

export function parseTrustedBaseUrls(raw: string | undefined | null): string[] {
  if (!raw) {
return []
}
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function originOf(url: URL): string {
  return `${url.protocol}//${url.host}`
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (BLOCKED_HOSTS.has(host)) {
return true
}
  return host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')
}

function ipv4Unsafe(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part))
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true
  }
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) {
return true
}
  if (a === 169 && b === 254) {
return true
}
  if (a === 172 && b >= 16 && b <= 31) {
return true
}
  if (a === 192 && b === 168) {
return true
}
  if (a === 100 && b >= 64 && b <= 127) {
return true
}
  if (a === 192 && b === 0) {
return true
}
  if (a === 198 && (b === 18 || b === 51)) {
return true
}
  if (a >= 224) {
return true
}
  return false
}

function ipUnsafe(address: string): boolean {
  const ip = address.toLowerCase()
  if (ip.startsWith('::ffff:')) {
return ipv4Unsafe(ip.slice('::ffff:'.length))
}
  if (isIP(ip) === 4) {
return ipv4Unsafe(ip)
}
  if (ip === '::1' || ip === '::') {
return true
}
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) {
return true
}
  return false
}

async function defaultLookup(hostname: string): Promise<Array<{ address: string }>> {
  const records = await dnsLookup(hostname, { all: true })
  return records.map((record) => ({ address: record.address }))
}

/**
 * 校验服务商基础地址:禁止凭据、内网、云元数据;仅允许 HTTPS,
 * 或服务端显式配置的可信源(用于本地代理)。
 */
export async function assertProviderBaseUrl(
  raw: string,
  trustedOrigins: string[],
  lookup: LookupFn = defaultLookup,
): Promise<string> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.invalid)
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.unsafe)
  }
  const origin = originOf(url)
  const trusted = trustedOrigins.some((item) => {
    try {
      return originOf(new URL(item)) === origin
    } catch {
      return false
    }
  })
  if (url.protocol !== 'https:' && !(trusted && url.protocol === 'http:')) {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.unsafe)
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isBlockedHostname(hostname)) {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.unsafe)
  }
  if (!trusted) {
    const addresses =
      isIP(hostname) > 0 ? [{ address: hostname }] : await lookup(hostname).catch(() => null)
    if (!addresses || addresses.length === 0 || addresses.some((item) => ipUnsafe(item.address))) {
      throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.unsafe)
    }
  }
  const baseUrl = url.href.replace(/\/+$/, '')
  if (/\/(chat\/completions|v1\/messages|messages)$/.test(baseUrl)) {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.invalid)
  }
  return baseUrl
}

export function defaultBaseUrl(protocol: AiProtocol): string {
  return AI_PROTOCOL_DEFAULT_BASE_URL[protocol]
}
