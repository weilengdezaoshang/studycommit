import { describe, expect, it } from 'vitest'
import { canonicalPaperPair } from './paper-knowledge.service'

describe('canonicalPaperPair', () => {
  it('先规范化大小写再按 uuid 字典序排列', () => {
    expect(
      canonicalPaperPair(
        'B1111111-1111-4111-8111-111111111111',
        'a1111111-1111-4111-8111-111111111111',
      ),
    ).toEqual(['a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111'])
  })
})
