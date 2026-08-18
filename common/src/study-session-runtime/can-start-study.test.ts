import { describe, expect, it } from 'vitest'
import { canStartStudy } from './can-start-study'

describe('canStartStudy', () => {
  it('requires both a topic and a non-empty goal', () => {
    expect(canStartStudy('', '理解 IPC')).toBe(false)
    expect(canStartStudy('topic-1', '   ')).toBe(false)
    expect(canStartStudy('topic-1', '理解 IPC')).toBe(true)
  })
})
