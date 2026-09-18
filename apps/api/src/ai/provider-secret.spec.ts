import { describe, expect, it } from 'vitest'
import {
  decryptSecret,
  encryptSecret,
  maskApiKey,
  parseEncryptionKey,
  requireEncryptionKey,
} from './provider-secret'

const KEY = parseEncryptionKey('00'.repeat(32))!

describe('provider-secret', () => {
  it('使用 AES-256-GCM 加密后可解密回原文', () => {
    const payload = encryptSecret('sk-test-not-real', KEY)
    expect(payload.startsWith('sc1:')).toBe(true)
    expect(payload).not.toContain('sk-test-not-real')
    expect(decryptSecret(payload, KEY)).toBe('sk-test-not-real')
  })

  it('同一明文两次加密得到不同密文', () => {
    expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY))
  })

  it('缺少主密钥时拒绝写入', () => {
    expect(() => requireEncryptionKey(undefined)).toThrow()
    try {
      requireEncryptionKey('')
    } catch (error) {
      expect(error).toMatchObject({ response: { code: 'AI_PROVIDER_ENCRYPTION_KEY_MISSING' } })
    }
  })

  it('脱敏标识只保留末四位', () => {
    expect(maskApiKey('sk-live-abcdef')).toBe('••••cdef')
    expect(maskApiKey('ab')).toBe('••••')
  })

  it('拒绝格式错误的主密钥', () => {
    expect(() => parseEncryptionKey('too-short')).toThrow('32 字节')
  })
})
