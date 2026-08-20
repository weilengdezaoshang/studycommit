import { describe, expect, it, vi } from 'vitest'
import { LEARNING_LOG_ERROR, LEARNING_LOG_KIND } from './learning-log.constants'
import { LearningLogsService } from './learning-logs.service'

const learningLog = {
  id: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  gains: '理解事务',
  problems: null,
  nextStep: null,
  version: 1,
}

describe('LearningLogsService', () => {
  it('maps missing logs to a stable not-found error', async () => {
    const repository = { findBySession: vi.fn().mockResolvedValue(null) }
    await expect(
      new LearningLogsService(repository as never).getBySession(
        crypto.randomUUID(),
        crypto.randomUUID(),
      ),
    ).rejects.toMatchObject({
      response: { code: LEARNING_LOG_ERROR.notFound.code },
    })
  })

  it('maps version conflicts without hiding the latest log', async () => {
    const latest = { ...learningLog, version: 2 }
    const repository = {
      update: vi.fn().mockResolvedValue({
        kind: LEARNING_LOG_KIND.versionConflict,
        learningLog: latest,
      }),
    }
    await expect(
      new LearningLogsService(repository as never).update(crypto.randomUUID(), learningLog.id, {
        version: 1,
        gains: '补充',
      }),
    ).rejects.toMatchObject({
      response: {
        code: LEARNING_LOG_ERROR.versionConflict.code,
        details: { learningLog: latest },
      },
    })
  })

  it('returns the current log for a no-op update', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue({ kind: LEARNING_LOG_KIND.ok, learningLog }),
    }
    await expect(
      new LearningLogsService(repository as never).update(crypto.randomUUID(), learningLog.id, {
        version: 1,
        gains: '理解事务',
      }),
    ).resolves.toEqual(learningLog)
  })
})
