const { BackendError } = require('./errors')

const REQUEST_VERSION = 1
const STRIPPED_PAYLOAD_KEYS = [
  'userId',
  'openId',
  'openid',
  'unionId',
  'unionid',
  'authorization',
  'token',
]
const EXCHANGE_TTL_SAFETY_MS = 60_000

/** 解析统一请求信封；剥离客户端不可信的身份字段。 */
function parseEnvelope(event) {
  if (!event || typeof event !== 'object') {
    throw new BackendError('INVALID_INPUT', '请求信封非法')
  }
  const { version, operation, requestId, idempotencyKey, payload } = event
  if (version !== REQUEST_VERSION) {
    throw new BackendError('INVALID_INPUT', '请求协议版本不支持')
  }
  if (typeof operation !== 'string' || !operation) {
    throw new BackendError('INVALID_INPUT', '缺少 operation')
  }
  if (typeof requestId !== 'string' || !requestId) {
    throw new BackendError('INVALID_INPUT', '缺少 requestId')
  }
  if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !idempotencyKey)) {
    throw new BackendError('INVALID_INPUT', 'idempotencyKey 非法')
  }
  return {
    version: REQUEST_VERSION,
    operation,
    requestId,
    idempotencyKey,
    payload: sanitizePayload(payload),
  }
}

/** 客户端不得声明身份：userId/openId 等字段一律剥除，身份只来自微信上下文。 */
function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload === undefined ? null : payload
  }
  const clean = { ...payload }
  for (const key of STRIPPED_PAYLOAD_KEYS) {
    delete clean[key]
  }
  return clean
}

/**
 * backend 云函数上下文：
 * - 身份只来自 wx-server-sdk 的微信上下文（OPENID/APPID/UNIONID）；
 * - OPENID → userId 的身份交换结果按实例缓存，直到令牌临期。
 */
function createBackendContext(deps) {
  const { getWXContext, apiClient, log } = deps
  const now = deps.now || Date.now
  const identityCache = deps.identityCache || new Map()

  function getUserContext(requestId) {
    const wxContext = getWXContext() || {}
    const openId = wxContext.OPENID
    if (!openId) {
      throw new BackendError('UNAUTHENTICATED', '缺少微信身份')
    }
    return {
      openId,
      appId: wxContext.APPID || '',
      ...(wxContext.UNIONID ? { unionId: wxContext.UNIONID } : {}),
      requestId,
    }
  }

  async function requireIdentity(userContext) {
    const cached = identityCache.get(userContext.openId)
    if (cached && cached.expiresAtMs - now() > EXCHANGE_TTL_SAFETY_MS) {
      return cached
    }
    try {
      const session = await apiClient.exchangeIdentity({
        openId: userContext.openId,
        unionId: userContext.unionId,
        requestId: userContext.requestId,
      })
      const expiresAtMs = Date.parse(session.tokens.expiresAt)
      const identity = {
        token: session.tokens.accessToken,
        userId: session.user.id,
        expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : 0,
      }
      identityCache.set(userContext.openId, identity)
      log.info(
        JSON.stringify({
          event: 'identity_exchange',
          requestId: userContext.requestId,
          durationMs: now() - userContext.startedAt,
        }),
      )
      return identity
    } catch (error) {
      identityCache.delete(userContext.openId)
      throw error
    }
  }

  return { getUserContext, requireIdentity, parseEnvelope }
}

module.exports = { createBackendContext, parseEnvelope, sanitizePayload, REQUEST_VERSION }
