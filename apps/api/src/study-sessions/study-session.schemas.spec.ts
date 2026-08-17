import { describe, expect, it } from 'vitest'
import { SESSION_COMPLETION_SOURCE } from './study-session.constants'
import {
  completeStudySessionSchema,
  createStudySessionSchema,
  sessionCommandSchema,
} from './study-session.schemas'

describe('study session schemas', () => {
  it('normalizes an empty goal and validates commands', () => {
    expect(
      createStudySessionSchema.parse({ topicId: crypto.randomUUID(), goal: '  ' }).goal,
    ).toBeNull()
    expect(sessionCommandSchema.safeParse({ version: 0 }).success).toBe(false)
  })

  it('requires endedAt only for offline completion', () => {
    expect(
      completeStudySessionSchema.safeParse({
        version: 1,
        completionSource: SESSION_COMPLETION_SOURCE.offlineSync,
      }).success,
    ).toBe(false)
    expect(
      completeStudySessionSchema.safeParse({ version: 1, endedAt: new Date().toISOString() })
        .success,
    ).toBe(false)
    expect(completeStudySessionSchema.safeParse({ version: 1 }).success).toBe(true)
  })
})
