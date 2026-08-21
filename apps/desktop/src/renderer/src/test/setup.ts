import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const emptyActive = {
  ok: true as const,
  data: { session: null, serverNow: '2026-08-17T08:00:00.000Z' },
}

function createDefaultStudyCommit() {
  return {
    platform: 'darwin' as NodeJS.Platform,
    studySessions: {
      create: async () => ({ ok: false as const, error: configurationError() }),
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
    },
    learningLogs: {
      getBySession: async () => ({ ok: false as const, error: configurationError() }),
      update: async () => ({ ok: false as const, error: configurationError() }),
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

if (typeof window !== 'undefined') {
  window.studyCommit = createDefaultStudyCommit()
}

afterEach(() => {
  cleanup()
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
    window.studyCommit = createDefaultStudyCommit()
  }
})
