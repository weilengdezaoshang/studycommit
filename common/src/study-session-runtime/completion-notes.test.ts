import { describe, expect, it } from 'vitest'
import { COMPLETION_NOTE_FIELDS, trimToNull } from './completion-notes'

describe('completion notes', () => {
  it('keeps field limits aligned with the complete schema', () => {
    expect(COMPLETION_NOTE_FIELDS.map((field) => [field.key, field.maxLength])).toEqual([
      ['gains', 10_000],
      ['problems', 10_000],
      ['nextStep', 5_000],
    ])
  })

  it('turns blank strings into null', () => {
    expect(trimToNull(undefined)).toBeNull()
    expect(trimToNull('')).toBeNull()
    expect(trimToNull('   ')).toBeNull()
    expect(trimToNull(' 理解事务 ')).toBe('理解事务')
  })
})
