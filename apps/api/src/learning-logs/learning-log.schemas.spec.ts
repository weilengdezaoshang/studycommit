import { describe, expect, it } from 'vitest'
import { listLearningLogsQuerySchema, updateLearningLogSchema } from './learning-log.schemas'

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

  it('normalizes list pagination and accepts filters', () => {
    const result = listLearningLogsQuerySchema.parse({
      page: '2',
      pageSize: '50',
      from: '2026-08-01T00:00:00.000Z',
    })
    expect(result).toMatchObject({ page: 2, pageSize: 50 })
    expect(listLearningLogsQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 })
    expect(listLearningLogsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
    expect(listLearningLogsQuerySchema.safeParse({ page: 10_001 }).success).toBe(false)
    expect(
      listLearningLogsQuerySchema.safeParse({
        from: '2026-08-31T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})
