import { describe, expect, it } from 'vitest'
import { emptyLearningLogFixture } from './learning-log.fixture'
import { learningLogSchema, updateLearningLogInputSchema } from './learning-log.schema'

describe('learning log contracts', () => {
  it('accepts an empty summary snapshot', () => {
    expect(learningLogSchema.parse(emptyLearningLogFixture)).toEqual(emptyLearningLogFixture)
  })

  it('rejects a negative duration', () => {
    expect(
      learningLogSchema.safeParse({
        ...emptyLearningLogFixture,
        effectiveDurationSeconds: -1,
      }).success,
    ).toBe(false)
  })

  it('requires at least one summary field and normalizes blank text', () => {
    const base = { id: emptyLearningLogFixture.id, version: 1 }
    expect(updateLearningLogInputSchema.safeParse(base).success).toBe(false)
    expect(updateLearningLogInputSchema.parse({ ...base, gains: '  ' }).gains).toBeNull()
    expect(updateLearningLogInputSchema.parse({ ...base, problems: null }).problems).toBeNull()
    expect(
      updateLearningLogInputSchema.safeParse({ ...base, nextStep: 'a'.repeat(5_001) }).success,
    ).toBe(false)
    expect(
      updateLearningLogInputSchema.safeParse({
        ...base,
        gains: 'ok',
        effectiveDurationSeconds: 1,
      }).success,
    ).toBe(false)
  })
})
