const { createBackendContext, parseEnvelope } = require('./context')
const { createRouter } = require('./router')
const { ok, fail, BackendError, isBackendError } = require('./errors')

/**
 * backend 统一入口云函数：
 * 信封解析 → 微信身份解析 → operation 白名单路由 →（按需）OPENID→用户身份交换
 * → 白名单转发现有 API / 云存储能力 → 统一成功或失败信封。
 * 日志只记录 operation、requestId、耗时与错误码，不记录 payload 与身份。
 */
function createBackendHandler(deps) {
  const { getWXContext, apiClient, cloud, env, log } = deps
  const now = deps.now || Date.now
  const router = deps.router || createRouter()
  const context = createBackendContext({
    getWXContext,
    apiClient,
    log,
    now,
    ...(deps.identityCache ? { identityCache: deps.identityCache } : {}),
  })

  return async function main(event) {
    const startedAt = now()
    let requestId = 'unknown'
    let operation = 'unknown'
    try {
      const envelope = parseEnvelope(event)
      requestId = envelope.requestId
      operation = envelope.operation
      const route = router.resolve(operation)
      if (!route) {
        throw new BackendError('INVALID_INPUT', `未知操作：${operation}`)
      }
      const userContext = { ...context.getUserContext(requestId), startedAt }
      let data
      if (route.auth === 'exchange') {
        // 登录：OPENID → 现有账号模型 → 会话（复用产品既有的自动建号规则）。
        data = await apiClient.exchangeIdentity({
          openId: userContext.openId,
          unionId: userContext.unionId,
          requestId,
        })
      } else if (route.auth === 'identity') {
        const identity = await context.requireIdentity(userContext)
        data = await route.fn({
          forward: (method, path, body) =>
            apiClient.forward({
              method,
              path,
              body,
              token: identity.token,
              requestId,
              idempotencyKey: envelope.idempotencyKey,
            }),
          payload: envelope.payload,
          requestId,
          idempotencyKey: envelope.idempotencyKey,
          identity,
          userContext,
          env,
          log,
          // 身份操作同样可能触碰云资源（如 uploads.attach 的暂存与下载）。
          get db() {
            return cloud.database()
          },
          cloud,
          sendRaw: apiClient.sendRaw,
        })
      } else {
        data = await route.fn({
          payload: envelope.payload,
          requestId,
          idempotencyKey: envelope.idempotencyKey,
          userContext,
          env,
          log,
          // 数据库按需惰性获取：不访问云数据库的操作不初始化。
          get db() {
            return cloud.database()
          },
          cloud,
          // tokenOverride：唯一例外是 auth.logout 需要携带客户端本地令牌撤销其真实会话。
          forward: (method, path, body, tokenOverride) =>
            apiClient.forward({
              method,
              path,
              body,
              token: tokenOverride || '',
              requestId,
              idempotencyKey: envelope.idempotencyKey,
            }),
          sendRaw: apiClient.sendRaw,
        })
      }
      log.info(
        JSON.stringify({
          event: 'backend_call',
          operation,
          requestId,
          durationMs: now() - startedAt,
        }),
      )
      return ok(requestId, data === undefined ? null : data)
    } catch (error) {
      const code = isBackendError(error) ? error.code : 'PROVIDER_FAILED'
      log.error(
        JSON.stringify({
          event: 'backend_call_failed',
          operation,
          requestId,
          durationMs: now() - startedAt,
          code,
        }),
      )
      return fail(requestId, code, isBackendError(error) ? error.message : undefined)
    }
  }
}

module.exports = { createBackendHandler }
