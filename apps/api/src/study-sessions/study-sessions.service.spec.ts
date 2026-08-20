import { describe, expect, it, vi } from 'vitest'
import {
  SESSION_COMPLETION_SOURCE,
  SESSION_ERROR,
  SESSION_KIND,
  SESSION_ONE_ACTIVE_CONSTRAINT,
  SESSION_STATUS,
} from './study-session.constants'
import { StudySessionsService } from './study-sessions.service'

const userId = crypto.randomUUID()
const sessionId = crypto.randomUUID()
const topicId = crypto.randomUUID()
const session = { id: sessionId, topicId, status: SESSION_STATUS.running, version: 1 }

describe('StudySessionsService', () => {
  it('maps an existing active session to a useful conflict', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ kind: SESSION_KIND.activeExists, session }),
    }
    const service = new StudySessionsService(repository as never)
    await expect(service.create(userId, { topicId }, 'key')).rejects.toMatchObject({
      response: { code: SESSION_ERROR.activeExists.code, details: { sessionId } },
    })
  })

  it('maps version conflicts without hiding the latest session', async () => {
    const latest = { ...session, status: SESSION_STATUS.paused, version: 2 }
    const repository = {
      pause: vi.fn().mockResolvedValue({ kind: SESSION_KIND.versionConflict, session: latest }),
    }
    const service = new StudySessionsService(repository as never)
    await expect(service.pause(userId, sessionId, { version: 1 }, 'key')).rejects.toMatchObject({
      response: { code: SESSION_ERROR.versionConflict.code, details: { session: latest } },
    })
  })

  it('returns idempotent command replays unchanged', async () => {
    const repository = {
      resume: vi.fn().mockResolvedValue({ kind: SESSION_KIND.ok, session, replayed: true }),
    }
    await expect(
      new StudySessionsService(repository as never).resume(
        userId,
        sessionId,
        { version: 1 },
        'key',
      ),
    ).resolves.toEqual({ kind: SESSION_KIND.ok, session, replayed: true })
  })

  it('rejects an offline end time too far in the future', async () => {
    const repository = { complete: vi.fn(), now: vi.fn().mockResolvedValue(new Date()) }
    const service = new StudySessionsService(repository as never)
    const endedAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await expect(
      service.complete(
        userId,
        sessionId,
        {
          version: 1,
          endedAt,
          completionSource: SESSION_COMPLETION_SOURCE.offlineSync,
          gains: null,
          problems: null,
          nextStep: null,
        },
        'key',
      ),
    ).rejects.toMatchObject({ response: { code: SESSION_ERROR.invalidEndTime.code } })
    expect(repository.complete).not.toHaveBeenCalled()
  })

  it('retries create after a wrapped unique-index conflict', async () => {
    const wrapped = Object.assign(new Error('Failed query'), {
      cause: Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: SESSION_ONE_ACTIVE_CONSTRAINT,
      }),
    })
    const repository = {
      create: vi
        .fn()
        .mockRejectedValueOnce(wrapped)
        .mockResolvedValueOnce({ kind: SESSION_KIND.activeExists, session }),
    }
    await expect(
      new StudySessionsService(repository as never).create(userId, { topicId }, 'key'),
    ).rejects.toMatchObject({
      response: { code: SESSION_ERROR.activeExists.code, details: { sessionId } },
    })
    expect(repository.create).toHaveBeenCalledTimes(2)
  })
})
