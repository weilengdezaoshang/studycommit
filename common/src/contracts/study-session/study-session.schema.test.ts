import { describe, expect, it } from 'vitest'
import { completeStudySessionResultFixture } from '../learning-log/learning-log.fixture'
import {
  activeStudySessionResponseSchema,
  completeStudySessionInputSchema,
  completeStudySessionResultSchema,
  createStudySessionInputSchema,
  studySessionSchema,
} from './study-session.schema'
import {
  completedStudySessionFixture,
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from './study-session.fixture'

describe('study session contracts', () => {
  it.each([runningStudySessionFixture, pausedStudySessionFixture, completedStudySessionFixture])(
    'accepts a valid $status session',
    (fixture) => {
      expect(studySessionSchema.parse(fixture)).toEqual(fixture)
    },
  )

  it('rejects invalid status, version, and duration', () => {
    expect(
      studySessionSchema.safeParse({
        ...runningStudySessionFixture,
        status: 'unknown',
        version: 0,
        totalPausedSeconds: -1,
      }).success,
    ).toBe(false)
  })

  it('allows no active session', () => {
    expect(
      activeStudySessionResponseSchema.parse({
        session: null,
        serverNow: '2026-08-17T08:00:00.000Z',
      }).session,
    ).toBeNull()
  })

  it('normalizes a blank goal to null', () => {
    expect(
      createStudySessionInputSchema.parse({
        topicId: runningStudySessionFixture.topicId,
        goal: '  ',
        idempotencyKey: 'create-session-1',
      }).goal,
    ).toBeNull()
  })

  it('strips unknown session fields like the backend serializer', () => {
    expect(
      studySessionSchema.parse({
        ...runningStudySessionFixture,
        extra: 'ignored',
      }),
    ).toEqual(runningStudySessionFixture)
  })

  it('rejects unknown create fields', () => {
    expect(
      createStudySessionInputSchema.safeParse({
        topicId: runningStudySessionFixture.topicId,
        idempotencyKey: 'create-session-1',
        extra: true,
      }).success,
    ).toBe(false)
  })

  it('requires endedAt only for offline completion', () => {
    const base = {
      sessionId: runningStudySessionFixture.id,
      version: 1,
      idempotencyKey: 'complete-session-1',
    }
    expect(
      completeStudySessionInputSchema.safeParse({
        ...base,
        completionSource: 'offline_sync',
      }).success,
    ).toBe(false)
    expect(
      completeStudySessionInputSchema.safeParse({
        ...base,
        completionSource: 'online',
        endedAt: '2026-08-17T08:30:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      completeStudySessionInputSchema.safeParse({
        ...base,
        completionSource: 'online',
        endedAt: null,
      }).success,
    ).toBe(true)
  })

  it('normalizes empty summary fields and rejects oversized text', () => {
    const base = {
      sessionId: runningStudySessionFixture.id,
      version: 1,
      idempotencyKey: 'complete-session-1',
    }
    expect(
      completeStudySessionInputSchema.parse({
        ...base,
        gains: '  ',
        problems: null,
      }),
    ).toMatchObject({ gains: null, problems: null, nextStep: null })
    expect(
      completeStudySessionInputSchema.safeParse({
        ...base,
        gains: 'a'.repeat(10_001),
      }).success,
    ).toBe(false)
    expect(
      completeStudySessionInputSchema.safeParse({
        ...base,
        nextStep: 'a'.repeat(5_001),
      }).success,
    ).toBe(false)
    expect(
      completeStudySessionInputSchema.safeParse({
        ...base,
        topicId: runningStudySessionFixture.topicId,
      }).success,
    ).toBe(false)
  })

  it('accepts a combined complete result', () => {
    expect(completeStudySessionResultSchema.parse(completeStudySessionResultFixture)).toEqual(
      completeStudySessionResultFixture,
    )
  })
})
