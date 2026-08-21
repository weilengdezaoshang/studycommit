// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLearningLogFixture } from '@studycommit/common/contracts'

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
import { learningLogIpcChannels, registerLearningLogIpc } from './learning-log-ipc'

function trustedEvent() {
  return {
    sender: { isDestroyed: () => false },
    senderFrame: { url: 'http://localhost:5173/index.html', isDestroyed: () => false },
  }
}

describe('registerLearningLogIpc', () => {
  const client = {
    getBySession: vi.fn(),
    update: vi.fn(),
  }

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it('routes getBySession and update to the client', async () => {
    client.getBySession.mockResolvedValue(emptyLearningLogFixture)
    client.update.mockResolvedValue({ ...emptyLearningLogFixture, gains: '理解了事务', version: 2 })
    const host = new IpcHost({
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registerLearningLogIpc(host, client)
    expect(Object.keys(learningLogIpcChannels)).toEqual(['getBySession', 'update'])

    const found = await handlers.get(learningLogIpcChannels.getBySession)?.(
      trustedEvent(),
      emptyLearningLogFixture.sessionId,
    )
    expect(client.getBySession).toHaveBeenCalledWith(emptyLearningLogFixture.sessionId)
    expect(found).toEqual({ ok: true, data: emptyLearningLogFixture })

    const updated = await handlers.get(learningLogIpcChannels.update)?.(trustedEvent(), {
      id: emptyLearningLogFixture.id,
      version: 1,
      gains: '理解了事务',
    })
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: emptyLearningLogFixture.id,
        version: 1,
        gains: '理解了事务',
      }),
    )
    expect(updated).toEqual({
      ok: true,
      data: { ...emptyLearningLogFixture, gains: '理解了事务', version: 2 },
    })
  })

  it('rejects untrusted senders and invalid input without calling the client', async () => {
    const host = new IpcHost({
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registerLearningLogIpc(host, client)
    const untrusted = await handlers.get(learningLogIpcChannels.getBySession)?.({
      sender: { isDestroyed: () => false },
      senderFrame: { url: 'https://evil.example', isDestroyed: () => false },
    })
    expect(untrusted).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })

    const invalid = await handlers.get(learningLogIpcChannels.getBySession)?.(
      trustedEvent(),
      'bad-id',
    )
    expect(invalid).toMatchObject({ ok: false })
    expect(client.getBySession).not.toHaveBeenCalled()
  })
})
