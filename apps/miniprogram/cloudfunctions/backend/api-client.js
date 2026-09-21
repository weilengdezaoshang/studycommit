const { createHmac, createHash } = require('crypto')
const { BackendError, serviceErrorFromApiStatus } = require('./errors')

const DEFAULT_TIMEOUT_MS = 10000

/**
 * 内部 API 客户端：
 * - 身份交换使用 HMAC-SHA256 请求签名（INTERNAL_API_SIGNING_SECRET）；
 * - 业务转发使用交换所得访问令牌，仅允许白名单路径（由 router 静态映射保证）；
 * - 不把内部签名、令牌或上游错误细节透给客户端。
 */
function createInternalApiClient(deps) {
  const { env, sendRequest, log } = deps
  const now = deps.now || Date.now
  const baseUrl = (env.INTERNAL_API_BASE_URL || '').replace(/\/$/, '')
  const secret = env.INTERNAL_API_SIGNING_SECRET || ''
  const timeoutMs = Number.parseInt(env.INTERNAL_API_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS

  /** 签名覆盖时间戳与请求体摘要，服务端在 5 分钟窗口内校验防重放。 */
  function sign(timestamp, bodyText) {
    const bodyDigest = createHash('sha256').update(bodyText).digest('hex')
    return createHmac('sha256', secret).update(`${timestamp}\n${bodyDigest}`).digest('hex')
  }

  async function request(method, path, { headers = {}, body }) {
    if (!baseUrl) {
      throw new BackendError('SERVICE_DISABLED', '内部 API 未配置')
    }
    if (!baseUrl.startsWith('https://')) {
      // HTTPS 模块无法访问 HTTP 端口，提前给出明确错误而不是神秘的握手失败。
      throw new BackendError('SERVICE_DISABLED', '内部 API 地址必须使用 HTTPS')
    }
    const bodyText = body === undefined ? '' : JSON.stringify(body)
    const requestHeaders = {
      accept: 'application/json',
      ...headers,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    }
    let status = 0
    let responseText = ''
    try {
      const response = await sendRequest({
        method,
        url: `${baseUrl}${path}`,
        headers: requestHeaders,
        body: body === undefined ? undefined : bodyText,
        timeoutMs,
      })
      status = response.status
      responseText = response.bodyText
    } catch (error) {
      log.error(
        JSON.stringify({
          event: 'internal_api_error',
          method,
          path,
          message: error instanceof Error ? error.message : 'network',
        }),
      )
      throw new BackendError('NETWORK_ERROR', '内部服务不可达')
    }
    let parsed
    try {
      parsed = responseText ? JSON.parse(responseText) : undefined
    } catch {
      parsed = undefined
    }
    if (status < 200 || status >= 300) {
      throw serviceErrorFromApiStatus(status, parsed)
    }
    return parsed
  }

  /** 微信 OPENID → StudyCommit 会话（复用现有登录账号模型）。 */
  async function exchangeIdentity({ openId, unionId, requestId }) {
    if (!secret) {
      throw new BackendError('SERVICE_DISABLED', '内部签名密钥未配置')
    }
    const path = '/internal/auth/miniprogram/exchange'
    const body = { openId, ...(unionId ? { unionId } : {}) }
    const bodyText = JSON.stringify(body)
    const timestamp = String(now())
    const response = await request('POST', path, {
      body,
      headers: {
        'x-request-id': requestId,
        'x-internal-timestamp': timestamp,
        'x-internal-signature': sign(timestamp, bodyText),
      },
    })
    const payload = response && response.data ? response.data : response
    if (!payload || !payload.tokens || !payload.user) {
      throw new BackendError('ACCOUNT_NOT_LINKED', '账号未绑定')
    }
    return payload
  }

  /** 业务转发：白名单路径 + 用户令牌（空令牌不发鉴权头）+ 透传 requestId/idempotencyKey。 */
  async function forward({ method, path, token, body, requestId, idempotencyKey }) {
    return request(method, path, {
      body,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'x-request-id': requestId,
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
    })
  }

  async function sendRaw({ method, url, headers, body }) {
    const response = await sendRequest({ method, url, headers, body, timeoutMs })
    if (response.status < 200 || response.status >= 300) {
      throw new BackendError('PROVIDER_FAILED', '附件上传失败')
    }
  }

  return { exchangeIdentity, forward, sendRaw, isConfigured: () => Boolean(baseUrl && secret) }
}

/** 默认 HTTPS 传输（Node 运行时）；测试注入 sendRequest。 */
function createHttpsSendRequest(httpsModule) {
  const https = httpsModule || require('https')
  return function sendRequest({ method, url, headers, body, timeoutMs }) {
    return new Promise((resolve, reject) => {
      try {
        const target = new URL(url)
        const request = https.request(
          {
            method,
            hostname: target.hostname,
            port: target.port || 443,
            path: `${target.pathname}${target.search}`,
            headers,
            timeout: timeoutMs,
          },
          (response) => {
            let bodyText = ''
            response.setEncoding('utf8')
            response.on('data', (chunk) => {
              bodyText += chunk
            })
            response.on('end', () => resolve({ status: response.statusCode || 0, bodyText }))
          },
        )
        request.on('timeout', () => {
          request.destroy(new Error('timeout'))
        })
        request.on('error', reject)
        if (body !== undefined) {
          request.write(body)
        }
        request.end()
      } catch (error) {
        reject(error)
      }
    })
  }
}

module.exports = { createInternalApiClient, createHttpsSendRequest }
