import { describe, expect, it } from 'vitest'
import { updateLearningLogSchema } from './learning-log.schemas'

describe('learning log schemas', () => {
  it('requires at least one summary field and normalizes blank text', () => {
    expect(updateLearningLogSchema.safeParse({ version: 1 }).success).toBe(false)
    expect(updateLearningLogSchema.parse({ version: 1, gains: '  ' }).gains).toBeNull()
    expect(updateLearningLogSchema.parse({ version: 1, problems: null }).problems).toBeNull()
    expect(
      updateLearningLogSchema.safeParse({ version: 1, nextStep: 'a'.repeat(5_001) }).success,
    ).toBe(false)
    expect(
      updateLearningLogSchema.safeParse({
        version: 1,
        gains: 'ok',
        effectiveDurationSeconds: 12,
      }).success,
    ).toBe(false)
  })
})
