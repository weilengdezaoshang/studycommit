const { BackendError } = require('../errors')
const { buildQuery, pathSegment } = require('./util')

/** 记录业务转发：仅静态白名单路径，业务校验全部留在现有 API。 */
function createPapersOperations() {
  return {
    'papers.list': ({ forward, payload }) => forward('GET', buildQuery('/papers', payload)),
    'papers.get': ({ forward, payload }) => forward('GET', `/papers/${pathSegment(payload, 'id')}`),
    'papers.create': ({ forward, payload }) => forward('POST', '/papers', payload),
    'papers.update': ({ forward, payload }) =>
      forward('PATCH', `/papers/${pathSegment(payload, 'id')}`, payload),
    'papers.organize': ({ forward, payload }) =>
      forward('POST', `/papers/${pathSegment(payload, 'id')}/organize`, payload),
    'papers.moveToInbox': ({ forward, payload }) =>
      forward('POST', `/papers/${pathSegment(payload, 'id')}/move-to-inbox`, payload),
    'papers.remove': ({ forward, payload }) =>
      forward('DELETE', `/papers/${pathSegment(payload, 'id')}`, payload),
    'papers.resolveQuestion': ({ forward, payload }) =>
      forward('PATCH', `/papers/${pathSegment(payload, 'id')}/question`, payload),
    'papers.restore': ({ forward, payload }) =>
      forward('POST', `/papers/${pathSegment(payload, 'id')}/restore`, payload),
  }
}

function createPuzzleOperations() {
  return {
    'puzzles.album': ({ forward }) => forward('GET', '/puzzles/album'),
    'puzzles.selectArtwork': ({ forward, payload }) =>
      forward('POST', '/puzzles/selection', payload),
    'puzzles.reveal': ({ forward, payload }) =>
      forward('POST', `/puzzles/rewards/${pathSegment(payload, 'rewardId')}/reveal`, payload),
    'puzzles.featureArtwork': ({ forward, payload }) =>
      forward('POST', '/puzzles/featured', payload),
  }
}

/** 箱子（主题）业务转发。 */
function createTopicsOperations() {
  return {
    'topics.list': ({ forward, payload }) => forward('GET', buildQuery('/topics', payload)),
    'topics.create': ({ forward, payload }) => forward('POST', '/topics', payload),
    'topics.update': ({ forward, payload }) =>
      forward('PATCH', `/topics/${pathSegment(payload, 'id')}`, payload),
    'topics.remove': ({ forward, payload }) =>
      forward('DELETE', `/topics/${pathSegment(payload, 'id')}`, payload),
  }
}

/** 统一搜索转发。 */
function createSearchOperations() {
  return {
    'search.query': ({ forward, payload }) => forward('GET', buildQuery('/search', payload)),
  }
}

/** 学习会话转发。 */
function createStudySessionOperations() {
  const basePath = '/study-sessions'
  return {
    'studySessions.create': ({ forward, payload }) => forward('POST', basePath, payload),
    'studySessions.getActive': ({ forward }) => forward('GET', `${basePath}/active`),
    'studySessions.get': ({ forward, payload }) =>
      forward('GET', `${basePath}/${pathSegment(payload, 'sessionId')}`),
    'studySessions.pause': ({ forward, payload }) =>
      forward('POST', `${basePath}/${pathSegment(payload, 'sessionId')}/pause`, payload),
    'studySessions.resume': ({ forward, payload }) =>
      forward('POST', `${basePath}/${pathSegment(payload, 'sessionId')}/resume`, payload),
    'studySessions.complete': ({ forward, payload }) =>
      forward('POST', `${basePath}/${pathSegment(payload, 'sessionId')}/complete`, payload),
  }
}

/** 会话相关转发：刷新与退出不需要 OPENID 身份交换。 */
function createAuthOperations() {
  return {
    'auth.refresh': ({ forward, payload }) => forward('POST', '/auth/token/refresh', payload),
    'auth.logout': ({ forward, payload }) => {
      // 退出必须撤销客户端本地会话：携带本地访问令牌作为鉴权凭据，
      // 身份仍由 API 校验令牌得出（客户端无法借此声明他人身份）。
      const accessToken =
        payload && typeof payload.accessToken === 'string' ? payload.accessToken : ''
      if (!accessToken) {
        throw new BackendError('INVALID_INPUT', '缺少访问令牌')
      }
      return forward('POST', '/auth/logout', {}, accessToken)
    },
  }
}

/** 运营引导/活动/积分余额:只读转发;领取类写操作按平台适配进度单独开放。 */
function createOperationsOperations() {
  return {
    'operations.bootstrap': ({ forward }) => forward('GET', '/operations/bootstrap'),
  }
}

function createCampaignsOperations() {
  return {
    'campaigns.list': ({ forward }) => forward('GET', '/campaigns'),
    'campaigns.get': ({ forward, payload }) =>
      forward('GET', `/campaigns/${pathSegment(payload, 'id')}`),
  }
}

function createCreditsOperations() {
  return {
    'credits.balance': ({ forward }) => forward('GET', '/credits/balance'),
    'credits.ledger': ({ forward, payload }) =>
      forward('GET', buildQuery('/credits/ledger', payload)),
  }
}

module.exports = {
  createPapersOperations,
  createTopicsOperations,
  createSearchOperations,
  createStudySessionOperations,
  createAuthOperations,
  createOperationsOperations,
  createCampaignsOperations,
  createCreditsOperations,
  createPuzzleOperations,
}
