// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runningStudySessionFixture } from '@studycommit/common/contracts'
import { createHttpError } from '@studycommit/common/http'

const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      handlers.set(channel, listener)
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel)
    }),
  },
}))

import { StudySessionIpcRegistrar, studySessionIpcChannels } from './study-session-ipc'

function trustedEvent() {
  return {
    sender: { isDestroyed: () => false },
    senderFrame: { url: 'http://localhost:5173/index.html', isDestroyed: () => false },
  }
}

describe('StudySessionIpcRegistrar', () => {
  const client = {
    create: vi.fn(),
    getActive: vi.fn(),
    getById: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    complete: vi.fn(),
  }

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it('routes channels to the matching client methods', async () => {
    client.getActive.mockResolvedValue({
      session: null,
      serverNow: runningStudySessionFixture.startedAt,
    })
    const registrar = new StudySessionIpcRegistrar(client, {
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registrar.register()
    const result = await handlers.get(studySessionIpcChannels.getActive)?.(trustedEvent())
    expect(client.getActive).toHaveBeenCalledOnce()
    expect(result).toEqual({
      ok: true,
      data: { session: null, serverNow: runningStudySessionFixture.startedAt },
    })
  })

  it('rejects untrusted senders and invalid input without calling the client', async () => {
    const registrar = new StudySessionIpcRegistrar(client, {
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registrar.register()
    const untrusted = await handlers.get(studySessionIpcChannels.getActive)?.({
      sender: { isDestroyed: () => false },
      senderFrame: { url: 'https://evil.example', isDestroyed: () => false },
    })
    expect(untrusted).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })

    const invalid = await handlers.get(studySessionIpcChannels.getById)?.(trustedEvent(), 'bad-id')
    expect(invalid).toMatchObject({ ok: false })
    expect(client.getById).not.toHaveBeenCalled()
    expect(client.getActive).not.toHaveBeenCalled()
  })

  it('serializes HttpError and unknown failures safely', async () => {
    client.pause.mockRejectedValueOnce(
      createHttpError({
        code: 'CONFLICT',
        message: '学习会话版本冲突',
        details: { session: runningStudySessionFixture },
      }),
    )
    const registrar = new StudySessionIpcRegistrar(client, {
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registrar.register()
    const conflict = await handlers.get(studySessionIpcChannels.pause)?.(trustedEvent(), {
      sessionId: runningStudySessionFixture.id,
      version: 1,
      idempotencyKey: 'pause-1',
    })
    expect(conflict).toEqual({
      ok: false,
      error: {
        code: 'CONFLICT',
        message: '学习会话版本冲突',
        status: null,
        backendCode: null,
        requestId: null,
        details: { session: runningStudySessionFixture },
      },
    })

    client.resume.mockRejectedValueOnce(new Error('secret stack token=abc'))
    const unknown = await handlers.get(studySessionIpcChannels.resume)?.(trustedEvent(), {
      sessionId: runningStudySessionFixture.id,
      version: 1,
      idempotencyKey: 'resume-1',
    })
    expect(JSON.stringify(unknown)).not.toContain('token=abc')
    expect(unknown).toMatchObject({ ok: false, error: { code: 'UNKNOWN' } })
  })

  it('replaces previous handlers on re-register and cleans up on dispose', () => {
    const registrar = new StudySessionIpcRegistrar(client, {
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registrar.register()
    registrar.register()
    expect(handlers.size).toBe(6)
    registrar.dispose()
    expect(handlers.size).toBe(0)
  })

  it('does not throw when the caller window is gone', async () => {
    const sender = { closed: false, isDestroyed: () => sender.closed }
    const senderFrame = {
      url: 'http://localhost:5173/index.html',
      closed: false,
      isDestroyed: () => senderFrame.closed,
    }
    client.getActive.mockImplementation(async () => {
      sender.closed = true
      senderFrame.closed = true
      return { session: null, serverNow: runningStudySessionFixture.startedAt }
    })
    const registrar = new StudySessionIpcRegistrar(client, {
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registrar.register()
    const result = await handlers.get(studySessionIpcChannels.getActive)?.({ sender, senderFrame })
    expect(result).toMatchObject({ ok: false, error: { code: 'CANCELLED' } })
  })
})
