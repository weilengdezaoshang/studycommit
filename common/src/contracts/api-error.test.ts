import { describe, expect, it } from 'vitest'
import { apiErrorResponseSchema } from './api-error'
import { runningStudySessionFixture } from './study-session'

describe('api error contract', () => {
  it('keeps conflict details', () => {
    expect(
      apiErrorResponseSchema.parse({
        error: {
          code: 'SESSION_VERSION_CONFLICT',
          message: '学习会话版本冲突',
          details: { session: runningStudySessionFixture },
        },
        requestId: 'req-1',
        timestamp: '2026-08-17T08:00:00.000Z',
        path: '/api/study-sessions/1/pause',
      }).error.details,
    ).toEqual({ session: runningStudySessionFixture })
  })
})
