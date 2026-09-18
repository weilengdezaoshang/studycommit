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

export function ipv4Unsafe(ip: string): boolean {
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

export function ipUnsafe(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '').toLowerCase()
  if (ip.startsWith('::ffff:')) {
    return ipv4Unsafe(ip.slice('::ffff:'.length))
  }
  if (isIP(ip) === 4) {
    return ipv4Unsafe(ip)
  }
  if (isIP(ip) !== 6) {
    return true
  }
  if (ip === '::1' || ip === '::' || ip === '0:0:0:0:0:0:0:1' || ip === '0:0:0:0:0:0:0:0') {
    return true
  }
  const compact = ip.replace(/:0+/g, ':')
  if (
    compact.startsWith('fc') ||
    compact.startsWith('fd') ||
    compact.startsWith('fe8') ||
    compact.startsWith('fe9') ||
    compact.startsWith('fea') ||
    compact.startsWith('feb') ||
    compact.startsWith('ff')
  ) {
    return true
  }
  const first = ip.split(':')[0] ?? ''
  const n = Number.parseInt(first, 16)
  if (
    Number.isFinite(n) &&
    ((n & 0xfe00) === 0xfc00 || (n & 0xffc0) === 0xfe80 || (n & 0xff00) === 0xff00)
  ) {
    return true
  }
  return false
}

export function hostnameIsTrusted(hostname: string, trustedOrigins: string[]): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return trustedOrigins.some((item) => {
    try {
      return new URL(item).hostname.replace(/^\[|\]$/g, '').toLowerCase() === host
    } catch {
      return false
    }
  })
}

/** 校验实际 TCP 对端 IP:在连接建立后检查,而不是只在请求前做一次 DNS。 */
export function assertConnectedIp(hostname: string, ip: string, trustedOrigins: string[]): void {
  if (!ip) {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.unsafe)
  }
  if (hostnameIsTrusted(hostname, trustedOrigins)) {
    return
  }
  if (ipUnsafe(ip)) {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.unsafe)
  }
}

export function pickSafeConnectAddress(
  hostname: string,
  addresses: Array<{ address: string; family?: number }>,
  trustedOrigins: string[],
): { address: string; family: number } {
  const trusted = hostnameIsTrusted(hostname, trustedOrigins)
  const candidates = trusted ? addresses : addresses.filter((item) => !ipUnsafe(item.address))
  const first = candidates[0]
  if (!first) {
    throw new BadRequestException(AI_PROVIDER_ENDPOINT_ERROR.unsafe)
  }
  const family = first.family === 6 || isIP(first.address) === 6 ? 6 : 4
  return { address: first.address, family }
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
