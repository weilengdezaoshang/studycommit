// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runningStudySessionFixture } from '@studycommit/common/contracts'

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

import { IpcHost } from './ipc-host'
import { registerStudySessionIpc, studySessionIpcChannels } from './study-session-ipc'

function trustedEvent() {
  return {
    sender: { isDestroyed: () => false },
    senderFrame: { url: 'http://localhost:5173/index.html', isDestroyed: () => false },
  }
}

describe('registerStudySessionIpc', () => {
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
    const host = new IpcHost({
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registerStudySessionIpc(host, client)
    const result = await handlers.get(studySessionIpcChannels.getActive)?.(trustedEvent())
    expect(client.getActive).toHaveBeenCalledOnce()
    expect(result).toEqual({
      ok: true,
      data: { session: null, serverNow: runningStudySessionFixture.startedAt },
    })
  })

  it('rejects untrusted senders and invalid input without calling the client', async () => {
    const host = new IpcHost({
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registerStudySessionIpc(host, client)
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
})
