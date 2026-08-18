import { createHttpError } from '../http'

export type IdempotencyKeyProvider = () => string

type SubtleCryptoLike = {
  randomUUID?: () => string
  getRandomValues?: (bytes: Uint8Array) => unknown
}

let registeredProvider: IdempotencyKeyProvider | null = null

export function setIdempotencyKeyProvider(provider: IdempotencyKeyProvider | null): void {
  registeredProvider = provider
}

export function createIdempotencyKey(): string {
  if (registeredProvider) {
    return registeredProvider()
  }
  const cryptoApi = readCrypto()
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  if (typeof cryptoApi?.getRandomValues === 'function') {
    return uuidFromRandomValues(cryptoApi.getRandomValues)
  }
  throw createHttpError({ code: 'CONFIGURATION_ERROR', message: '当前环境无法生成幂等键' })
}

export function uuidFromRandomValues(getRandomValues: (bytes: Uint8Array) => unknown): string {
  const bytes = new Uint8Array(16)
  getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function readCrypto(): SubtleCryptoLike | undefined {
  const cryptoApi = (globalThis as { crypto?: SubtleCryptoLike }).crypto
  return cryptoApi && typeof cryptoApi === 'object' ? cryptoApi : undefined
}
