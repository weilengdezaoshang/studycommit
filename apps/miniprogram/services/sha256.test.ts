import { describe, expect, it } from 'vitest'
import { sha256 } from './sha256'

describe('sha256', () => {
  it('按原始字节生成标准摘要', () => {
    expect(sha256(new TextEncoder().encode('abc').buffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
