import { describe, expect, it, vi } from 'vitest'
import {
  activeTopicPageFixture,
  emptyLearningLogFixture,
  runningStudySessionFixture,
} from '@studycommit/common/contracts'
import { HttpError } from '@studycommit/common/http'
import {
  createDesktopLearningLogGateway,
  createDesktopStudySessionGateway,
  createDesktopTopicGateway,
  unwrapIpcResult,
} from './desktop-study-session-gateway'

describe('desktop study session gateway', () => {
  it('unwraps successful IPC results', () => {
    expect(unwrapIpcResult({ ok: true, data: runningStudySessionFixture })).toEqual(
      runningStudySessionFixture,
    )
  })

  it('turns serialized IPC errors into HttpError', () => {
    expect(() =>
      unwrapIpcResult({
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '网络不可用',
          status: null,
          backendCode: null,
          requestId: null,
          details: null,
        },
      }),
    ).toThrow(HttpError)
  })

  it('forwards session and topic calls through the preload API', async () => {
    const studySessions = {
      create: vi.fn(),
      getActive: vi.fn().mockResolvedValue({
        ok: true,
        data: { session: null, serverNow: runningStudySessionFixture.startedAt },
      }),
      getById: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      complete: vi.fn(),
    }
    const topics = {
      listActive: vi.fn().mockResolvedValue({ ok: true, data: activeTopicPageFixture }),
    }
    const learningLogs = {
      getBySession: vi.fn().mockResolvedValue({ ok: true, data: emptyLearningLogFixture }),
      update: vi.fn(),
    }
    await createDesktopStudySessionGateway(studySessions).getActive()
    await createDesktopTopicGateway(topics).listActive()
    await createDesktopLearningLogGateway(learningLogs).getBySession(
      emptyLearningLogFixture.sessionId,
    )
    expect(studySessions.getActive).toHaveBeenCalledOnce()
    expect(topics.listActive).toHaveBeenCalledOnce()
    expect(learningLogs.getBySession).toHaveBeenCalledWith(emptyLearningLogFixture.sessionId)
  })
})
