const {
  createPapersOperations,
  createTopicsOperations,
  createSearchOperations,
  createStudySessionOperations,
  createAuthOperations,
  createOperationsOperations,
  createCampaignsOperations,
  createCreditsOperations,
  createPuzzleOperations,
} = require('./handlers/business')
const { createCapabilitiesOperations, createUploadOperations } = require('./handlers/uploads')

/**
 * operation 白名单路由表（静态映射，禁止任意字符串动态加载）：
 * - auth: 'exchange'  → OPENID 走身份交换返回会话（auth.login）
 * - auth: 'identity'  → 需要交换出的用户令牌再转发
 * - auth: 'none'      → 仅需微信上下文，不访问内部 API 用户数据
 */
function createRouter() {
  const routes = {}

  function register(operations, auth) {
    for (const [operation, fn] of Object.entries(operations)) {
      routes[operation] = { auth, fn }
    }
  }

  register(createAuthOperations(), 'none')
  routes['auth.login'] = { auth: 'exchange' }
  register(createPapersOperations(), 'identity')
  register(createTopicsOperations(), 'identity')
  register(createSearchOperations(), 'identity')
  register(createStudySessionOperations(), 'identity')
  register(createOperationsOperations(), 'identity')
  register(createCampaignsOperations(), 'identity')
  register(createCreditsOperations(), 'identity')
  register(createPuzzleOperations(), 'identity')
  register(createCapabilitiesOperations(), 'none')
  register(createUploadOperations(), 'none')
  routes['uploads.access'] = {
    auth: 'identity',
    fn: ({ forward, payload }) => {
      const { pathSegment } = require('./handlers/util')
      return forward('GET', `/paper-assets/${pathSegment(payload, 'assetId')}/access`)
    },
  }
  // attach 需要用户令牌走预签名直传绑定，必须经过身份交换。
  routes['uploads.attach'] = { auth: 'identity', fn: createUploadOperations()['uploads.attach'] }

  return {
    /** 白名单查找；未注册的 operation 一律拒绝。 */
    resolve(operation) {
      return routes[operation] || null
    },
    operationNames() {
      return Object.keys(routes).sort()
    },
  }
}

module.exports = { createRouter }
