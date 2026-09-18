import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { ServiceUnavailableException } from '@nestjs/common'

const PREFIX = 'sc1'
const IV_LENGTH = 12
const KEY_LENGTH = 32
const AUTH_TAG_LENGTH = 16

export const AI_PROVIDER_ENCRYPTION_ERROR = {
  missing: {
    code: 'AI_PROVIDER_ENCRYPTION_KEY_MISSING',
    message: '未配置加密主密钥，拒绝写入服务商密钥',
  },
  invalid: {
    code: 'AI_PROVIDER_ENCRYPTION_KEY_INVALID',
    message: '加密主密钥无效',
  },
  decrypt: {
    code: 'AI_PROVIDER_SECRET_UNAVAILABLE',
    message: '无法解密服务商密钥',
  },
} as const

/** 解析 32 字节主密钥:允许 64 位 hex 或标准 base64,不接受明文口令。 */
export function parseEncryptionKey(raw: string | undefined | null): Buffer | null {
  if (!raw || raw.trim().length === 0) {
return null
}
  const trimmed = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }
  const fromBase64 = Buffer.from(trimmed, 'base64')
  if (fromBase64.length === KEY_LENGTH) {
    return fromBase64
  }
  throw new Error('AI_PROVIDER_ENCRYPTION_KEY 必须是 32 字节密钥（64 位 hex 或 base64）')
}

export function requireEncryptionKey(raw: string | undefined | null): Buffer {
  const key = parseEncryptionKey(raw)
  if (!key) {
    throw new ServiceUnavailableException(AI_PROVIDER_ENCRYPTION_ERROR.missing)
  }
  return key
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

export function decryptSecret(payload: string, key: Buffer): string {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new ServiceUnavailableException(AI_PROVIDER_ENCRYPTION_ERROR.decrypt)
  }
  const iv = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')
  const ciphertext = Buffer.from(parts[3], 'base64')
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new ServiceUnavailableException(AI_PROVIDER_ENCRYPTION_ERROR.decrypt)
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new ServiceUnavailableException(AI_PROVIDER_ENCRYPTION_ERROR.decrypt)
  }
}

/** 仅返回脱敏尾缀,不暴露完整密钥。 */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 4) {
return '••••'
}
  return `••••${trimmed.slice(-4)}`
}
