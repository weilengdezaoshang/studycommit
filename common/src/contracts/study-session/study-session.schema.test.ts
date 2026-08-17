import { describe, expect, it } from 'vitest'
import {
  activeStudySessionResponseSchema,
  completeStudySessionInputSchema,
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
  })
})
