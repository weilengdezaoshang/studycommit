// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeTopicPageFixture, runningStudySessionFixture } from '@studycommit/common/contracts'

const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  globalShortcut: { register: vi.fn(), unregister: vi.fn() },
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
import { aiIpcChannels } from '../../shared/ai-channels'
import { reviewIpcChannels } from '../../shared/review-channels'
import { searchIpcChannels } from '../../shared/search-channels'
import { paperIpcChannels } from '../../shared/paper-channels'
import { puzzleIpcChannels } from '../../shared/puzzle-channels'
import { authIpcChannels } from './auth-ipc'
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
      completePaper: vi.fn(),
      createFragment: vi.fn(),
      updateFragment: vi.fn(),
      listFragments: vi.fn(),
    },
    uploads: {
      create: vi.fn(),
      complete: vi.fn(),
      remove: vi.fn(),
      access: vi.fn(),
    },
    reviews: {
      monthly: vi.fn(),
    },
    search: {
      query: vi.fn(),
    },
    topics: {
      listActive: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    papers: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      organize: vi.fn(),
      moveToInbox: vi.fn(),
      remove: vi.fn(),
      updateQuestion: vi.fn(),
      restore: vi.fn(),
    },
    learningLogs: {
      list: vi.fn(),
      getBySession: vi.fn(),
      update: vi.fn(),
    },
    ai: {
      quote: vi.fn(),
      explainRun: vi.fn(),
      getRun: vi.fn(),
      confirmPaperExplain: vi.fn(),
    },
    auth: {
      registerAccount: vi.fn(),
      loginAccount: vi.fn(),
    },
  }

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it('注册全部通道并拦截未开放的陪学功能且统一释放通道', async () => {
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
        ...Object.values(authIpcChannels),
        ...Object.values(learningLogIpcChannels),
        ...Object.values(paperIpcChannels),
        ...Object.values(puzzleIpcChannels),
        // 计费通道:旧同步/流式入口已移除,仅注册报价/受理/查询/确认。
        ...Object.values(aiIpcChannels),
        ...Object.values(reviewIpcChannels),
        ...Object.values(searchIpcChannels),
      ].sort(),
    )

    const active = await handlers.get(studySessionIpcChannels.getActive)?.(trustedEvent())
    const topics = await handlers.get(topicIpcChannels.listActive)?.(trustedEvent())
    expect(active).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN', message: '陪学功能暂未开放' },
    })
    expect(topics).toEqual({ ok: true, data: activeTopicPageFixture })

    disposeIpc()
    expect(handlers.size).toBe(0)
  })
})
