import { describe, expect, it } from 'vitest'
import { emptyLearningLogFixture } from './learning-log.fixture'
import { learningLogSchema } from './learning-log.schema'

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
})
