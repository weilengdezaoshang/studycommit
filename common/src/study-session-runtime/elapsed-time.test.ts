import { describe, expect, it } from 'vitest'
import {
  completedStudySessionFixture,
  pausedStudySessionFixture,
  runningStudySessionFixture,
} from '../contracts/study-session'
import { calculateElapsedSeconds, estimateServerNowMs, formatElapsedClock } from './elapsed-time'

describe('elapsed time', () => {
  it('computes running time from estimated server now and subtracts paused seconds', () => {
    expect(
      calculateElapsedSeconds({
        session: { ...runningStudySessionFixture, totalPausedSeconds: 120 },
        estimatedServerNowMs: Date.parse('2026-08-17T08:30:00.000Z'),
      }),
    ).toBe(1680)
  })

  it('freezes paused sessions at pausedAt', () => {
    expect(
      calculateElapsedSeconds({
        session: pausedStudySessionFixture,
        estimatedServerNowMs: Date.parse('2026-08-17T10:00:00.000Z'),
      }),
    ).toBe(1200)
  })

  it('uses completed durationSeconds and never goes below zero', () => {
    expect(
      calculateElapsedSeconds({
        session: completedStudySessionFixture,
        estimatedServerNowMs: Date.parse('2026-08-17T12:00:00.000Z'),
      }),
    ).toBe(1800)
    expect(
      calculateElapsedSeconds({
        session: {
          ...runningStudySessionFixture,
          startedAt: '2026-08-17T08:10:00.000Z',
          totalPausedSeconds: 9999,
        },
        estimatedServerNowMs: Date.parse('2026-08-17T08:10:01.000Z'),
      }),
    ).toBe(0)
  })

  it('does not follow the device wall clock after sync', () => {
    const estimated = estimateServerNowMs('2026-08-17T08:00:00.000Z', 1000, 4000)
    expect(estimated).toBe(Date.parse('2026-08-17T08:00:03.000Z'))
    expect(
      calculateElapsedSeconds({
        session: runningStudySessionFixture,
        estimatedServerNowMs: estimated,
      }),
    ).toBe(3)
  })

  it('formats clocks over 24 hours with a stable HH:MM:SS strategy', () => {
    expect(formatElapsedClock(18 * 3600 + 32)).toBe('18:00:32')
    expect(formatElapsedClock(26 * 3600 + 5)).toBe('26:00:05')
    expect(formatElapsedClock(1.9)).toBe('00:00:01')
  })
})
