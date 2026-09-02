import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltValue, hashValue] = stored.split('$')
  if (scheme !== 'scrypt' || !saltValue || !hashValue) {
    return false
  }
  const salt = Buffer.from(saltValue, 'base64url')
  const expected = Buffer.from(hashValue, 'base64url')
  if (expected.length === 0) {
    return false
  }
  const actual = (await scrypt(password, salt, expected.length)) as Buffer
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function normalizeAccount(account: string): string {
  return account.trim().toLowerCase()
}

let dummyHash: Promise<string> | undefined

/** 账号不存在时也走一次 scrypt，避免用耗时判断账号是否已注册。 */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword('\0studycommit-dummy-password')
  return dummyHash
}
