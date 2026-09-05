const UUID_HEX = '0123456789abcdef'

/** 生成 RFC 4122 v4 UUID;小程序运行时没有 crypto.randomUUID。 */
export function createIdempotencyKey(): string {
  let uuid = ''
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      uuid += '-'
      continue
    }
    if (index === 14) {
      uuid += '4'
      continue
    }
    if (index === 19) {
      uuid += UUID_HEX[8 + Math.floor(Math.random() * 4)]
      continue
    }
    uuid += UUID_HEX[Math.floor(Math.random() * 16)]
  }
  return uuid
}
