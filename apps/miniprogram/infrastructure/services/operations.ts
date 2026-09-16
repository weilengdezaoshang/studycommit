import type { OperationRegistry } from '../transport/transport.types'

/**
 * 统一业务操作注册表：
 * - 云函数 operation 名与键名一致（backend 云函数白名单同源）；
 * - http 路由描述现有 oRPC REST 路径；缺省 http 表示该操作仅云函数可用；
 * - 页面与业务 Store 只使用这里的 operation 名，不拼接路径或云函数名。
 */
const OPERATIONS: OperationRegistry = {
  // 登录与会话
  'auth.login': {
    kind: 'write',
    http: { method: 'POST', path: '/auth/wechat/miniprogram', access: 'public' },
  },
  'auth.refresh': {
    kind: 'write',
    http: { method: 'POST', path: '/auth/token/refresh', access: 'public' },
  },
  'auth.logout': { kind: 'write', http: { method: 'POST', path: '/auth/logout' } },

  // 能力开关（云函数专属；HTTP 模式使用本地默认能力）
  'capabilities.get': { kind: 'read' },

  // 记录
  'papers.list': {
    kind: 'read',
    http: {
      method: 'GET',
      path: '/papers',
      query: (input) => {
        const value = (input ?? {}) as Record<string, string | number | undefined>
        return {
          status: value.status,
          topicId: value.topicId,
          questionStatus: value.questionStatus,
          limit: value.limit,
          cursor: value.cursor,
        }
      },
    },
  },
  'papers.get': {
    kind: 'read',
    http: { method: 'GET', path: (input) => `/papers/${encodeURIComponent(paperId(input))}` },
  },
  'papers.create': {
    kind: 'write',
    http: { method: 'POST', path: '/papers' },
  },
  'papers.update': {
    kind: 'write',
    http: { method: 'PATCH', path: (input) => `/papers/${encodeURIComponent(paperId(input))}` },
  },
  'papers.organize': {
    kind: 'write',
    http: {
      method: 'POST',
      path: (input) => `/papers/${encodeURIComponent(paperId(input))}/organize`,
    },
  },
  'papers.moveToInbox': {
    kind: 'write',
    http: {
      method: 'POST',
      path: (input) => `/papers/${encodeURIComponent(paperId(input))}/move-to-inbox`,
    },
  },
  'papers.remove': {
    kind: 'write',
    http: { method: 'DELETE', path: (input) => `/papers/${encodeURIComponent(paperId(input))}` },
  },
  'papers.resolveQuestion': {
    kind: 'write',
    http: {
      method: 'PATCH',
      path: (input) => `/papers/${encodeURIComponent(paperId(input))}/question`,
    },
  },
  'papers.restore': {
    kind: 'write',
    http: {
      method: 'POST',
      path: (input) => `/papers/${encodeURIComponent(paperId(input))}/restore`,
    },
  },

  // 箱子（主题）
  'topics.list': {
    kind: 'read',
    http: {
      method: 'GET',
      path: '/topics',
      query: (input) => ({ limit: (input as { limit?: number } | undefined)?.limit }),
    },
  },
  'topics.create': { kind: 'write', http: { method: 'POST', path: '/topics' } },
  'topics.update': {
    kind: 'write',
    http: { method: 'PATCH', path: (input) => `/topics/${encodeURIComponent(topicId(input))}` },
  },
  'topics.remove': {
    kind: 'write',
    http: { method: 'DELETE', path: (input) => `/topics/${encodeURIComponent(topicId(input))}` },
  },

  // 搜索
  'search.query': {
    kind: 'read',
    http: {
      method: 'GET',
      path: '/search',
      query: (input) => {
        const value = (input ?? {}) as Record<string, string | number | undefined>
        return { q: value.q, limit: value.limit, cursor: value.cursor }
      },
    },
  },

  // 学习会话
  'studySessions.create': { kind: 'write', http: { method: 'POST', path: '/study-sessions' } },
  'studySessions.getActive': {
    kind: 'read',
    http: { method: 'GET', path: '/study-sessions/active' },
  },
  'studySessions.get': {
    kind: 'read',
    http: {
      method: 'GET',
      path: (input) => `/study-sessions/${encodeURIComponent(sessionId(input))}`,
    },
  },
  'studySessions.pause': {
    kind: 'write',
    http: {
      method: 'POST',
      path: (input) => `/study-sessions/${encodeURIComponent(sessionId(input))}/pause`,
    },
  },
  'studySessions.resume': {
    kind: 'write',
    http: {
      method: 'POST',
      path: (input) => `/study-sessions/${encodeURIComponent(sessionId(input))}/resume`,
    },
  },
  'studySessions.complete': {
    kind: 'write',
    http: {
      method: 'POST',
      path: (input) => `/study-sessions/${encodeURIComponent(sessionId(input))}/complete`,
    },
  },

  // 上传会话与资产访问
  'uploads.create': { kind: 'write', http: { method: 'POST', path: '/uploads' } },
  'uploads.complete': {
    kind: 'write',
    http: {
      method: 'POST',
      path: (input) => `/uploads/${encodeURIComponent(uploadId(input))}/complete`,
    },
  },
  'uploads.access': {
    kind: 'read',
    http: {
      method: 'GET',
      path: (input) => `/paper-assets/${encodeURIComponent(assetId(input))}/access`,
    },
  },
  // 云函数专属：云存储暂存与附件绑定
  'uploads.stage': { kind: 'write' },
  'uploads.attach': { kind: 'write' },
  'uploads.stageTemp': { kind: 'write' },
  'uploads.cleanupTemp': { kind: 'write' },
}

function paperId(input: unknown): string {
  return requireString(input, 'id')
}
function topicId(input: unknown): string {
  return requireString(input, 'id')
}
function sessionId(input: unknown): string {
  return requireString(input, 'sessionId')
}
function uploadId(input: unknown): string {
  return requireString(input, 'uploadId')
}
function assetId(input: unknown): string {
  return requireString(input, 'assetId')
}
function requireString(input: unknown, key: string): string {
  const value = (input as Record<string, unknown> | undefined)?.[key]
  if (typeof value !== 'string' || !value) {
    throw new Error(`操作缺少参数 ${key}`)
  }
  return value
}

export const MINIPROGRAM_OPERATIONS = OPERATIONS
