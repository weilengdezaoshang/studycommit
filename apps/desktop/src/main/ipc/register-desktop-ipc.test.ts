// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeTopicPageFixture, runningStudySessionFixture } from '@studycommit/common/contracts'

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

import { learningLogIpcChannels } from '../../shared/learning-log-channels'
import { registerDesktopIpc } from './register-desktop-ipc'
import { studySessionIpcChannels } from './study-session-ipc'
import { topicIpcChannels } from './topic-ipc'

function trustedEvent() {
  return {
    sender: { isDestroyed: () => false },
    senderFrame: { url: 'http://localhost:5173/index.html', isDestroyed: () => false },
  }
}

describe('registerDesktopIpc', () => {
  const services = {
    studySessions: {
      create: vi.fn(),
      getActive: vi.fn(),
      getById: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      complete: vi.fn(),
    },
    topics: {
      listActive: vi.fn(),
    },
    learningLogs: {
      getBySession: vi.fn(),
      update: vi.fn(),
    },
  }

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it('registers every desktop channel and disposes them together', async () => {
    services.studySessions.getActive.mockResolvedValue({
      session: null,
      serverNow: runningStudySessionFixture.startedAt,
    })
    services.topics.listActive.mockResolvedValue(activeTopicPageFixture)

    const disposeIpc = registerDesktopIpc(services, {
      isDev: true,
      rendererDevOrigin: 'http://localhost:5173',
    })

    expect([...handlers.keys()].sort()).toEqual(
      [
        ...Object.values(studySessionIpcChannels),
        ...Object.values(topicIpcChannels),
        ...Object.values(learningLogIpcChannels),
      ].sort(),
    )

    const active = await handlers.get(studySessionIpcChannels.getActive)?.(trustedEvent())
    const topics = await handlers.get(topicIpcChannels.listActive)?.(trustedEvent())
    expect(active).toEqual({
      ok: true,
      data: { session: null, serverNow: runningStudySessionFixture.startedAt },
    })
    expect(topics).toEqual({ ok: true, data: activeTopicPageFixture })

    disposeIpc()
    expect(handlers.size).toBe(0)
  })
})
