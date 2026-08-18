// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeTopicPageFixture } from '@studycommit/common/contracts'

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
import { registerTopicIpc, topicIpcChannels } from './topic-ipc'

function trustedEvent() {
  return {
    sender: { isDestroyed: () => false },
    senderFrame: { url: 'http://localhost:5173/index.html', isDestroyed: () => false },
  }
}

describe('registerTopicIpc', () => {
  const client = {
    listActive: vi.fn(),
  }

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it('only exposes listActive and routes it to the client', async () => {
    client.listActive.mockResolvedValue(activeTopicPageFixture)
    const host = new IpcHost({
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registerTopicIpc(host, client)
    expect(Object.keys(topicIpcChannels)).toEqual(['listActive'])
    const result = await handlers.get(topicIpcChannels.listActive)?.(trustedEvent())
    expect(client.listActive).toHaveBeenCalledWith({})
    expect(result).toEqual({ ok: true, data: activeTopicPageFixture })
  })

  it('rejects untrusted senders and invalid input', async () => {
    const host = new IpcHost({
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })
    registerTopicIpc(host, client)
    const untrusted = await handlers.get(topicIpcChannels.listActive)?.({
      sender: { isDestroyed: () => false },
      senderFrame: { url: 'https://evil.example', isDestroyed: () => false },
    })
    expect(untrusted).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(client.listActive).not.toHaveBeenCalled()

    const invalid = await handlers.get(topicIpcChannels.listActive)?.(trustedEvent(), { limit: 0 })
    expect(invalid).toMatchObject({ ok: false })
    expect(client.listActive).not.toHaveBeenCalled()
  })
})
