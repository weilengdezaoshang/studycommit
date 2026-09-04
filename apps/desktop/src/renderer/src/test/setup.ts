import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { beforeEach } from 'vitest'

const emptyActive = {
  ok: true as const,
  data: { session: null, serverNow: '2026-08-17T08:00:00.000Z' },
}

function createDefaultStudyCommit() {
  return {
    platform: 'darwin' as NodeJS.Platform,
    studySessions: {
      create: async () => ({ ok: false as const, error: configurationError() }),
      update: async () => ({ ok: false as const, error: configurationError() }),
      remove: async () => ({ ok: false as const, error: configurationError() }),
      getActive: async () => emptyActive,
      getById: async () => ({ ok: false as const, error: configurationError() }),
      pause: async () => ({ ok: false as const, error: configurationError() }),
      resume: async () => ({ ok: false as const, error: configurationError() }),
      complete: async () => ({ ok: false as const, error: configurationError() }),
    },
    topics: {
      listActive: async () => ({
        ok: true as const,
        data: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
      }),
      create: async () => ({ ok: false as const, error: configurationError() }),
      update: async () => ({ ok: false as const, error: configurationError() }),
      remove: async () => ({ ok: false as const, error: configurationError() }),
    },
    papers: {
      // 默认失败:渲染层测试继续使用种子演示数据;需要的用例自行覆盖 papers.list
      list: async () => ({ ok: false as const, error: configurationError() }),
      create: async () => ({ ok: false as const, error: configurationError() }),
      update: async () => ({ ok: false as const, error: configurationError() }),
      organize: async () => ({ ok: false as const, error: configurationError() }),
      moveToInbox: async () => ({ ok: false as const, error: configurationError() }),
      remove: async () => ({ ok: false as const, error: configurationError() }),
    },
    learningLogs: {
      list: async () => ({ ok: false as const, error: configurationError() }),
      getBySession: async () => ({ ok: false as const, error: configurationError() }),
      update: async () => ({ ok: false as const, error: configurationError() }),
    },
    ai: {
      explainPaper: async () => ({ ok: false as const, error: configurationError() }),
      confirmPaperExplain: async () => ({ ok: false as const, error: configurationError() }),
    },
    auth: {
      registerAccount: async () => ({ ok: false as const, error: configurationError() }),
      loginAccount: async () => ({ ok: false as const, error: configurationError() }),
    },
  }
}

function configurationError() {
  return {
    code: 'CONFIGURATION_ERROR' as const,
    message: '测试默认桥未配置该操作',
    status: null,
    backendCode: null,
    requestId: null,
    details: null,
  }
}

// 工作区测试默认处于已登录状态;登录页相关测试自行清除会话。
const DEFAULT_SESSION = {
  user: { id: 'test-user', nickname: '测试用户', avatarUrl: null, status: 'active' },
  tokens: {
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
}

function seedAuthSession() {
  window.localStorage.setItem(
    'studycommit.desktop.auth.session.v1',
    JSON.stringify(DEFAULT_SESSION),
  )
}

if (typeof window !== 'undefined') {
  window.studyCommit = createDefaultStudyCommit()
  seedAuthSession()
}

beforeEach(() => {
  if (typeof window !== 'undefined') {
    seedAuthSession()
  }
})

afterEach(() => {
  cleanup()
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
    window.studyCommit = createDefaultStudyCommit()
    seedAuthSession()
  }
})
