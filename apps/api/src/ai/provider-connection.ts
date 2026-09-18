import { AI_PROTOCOL_DEFAULT_BASE_URL, type AiProtocol } from './ai-provider'
import { createProviderFetch, providerRequestInit } from './provider-http'

export type ProviderProbeCode = 'connected' | 'auth_failed' | 'timeout' | 'rate_limited' | 'failed'

export interface ProviderProbeResult {
  ok: boolean
  code: ProviderProbeCode
  message: string
}

export interface ProviderProbeInput {
  protocol: AiProtocol
  baseUrl: string
  model: string
  apiKey: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  trustedOrigins?: string[]
}

const MESSAGES: Record<ProviderProbeCode, string> = {
  connected: '连接成功',
  auth_failed: '服务商拒绝了凭据',
  timeout: '连接超时',
  rate_limited: '服务商限流，请稍后重试',
  failed: '连接失败',
}

function classifyStatus(status: number): ProviderProbeCode {
  if (status === 401 || status === 403) {
    return 'auth_failed'
  }
  if (status === 429) {
    return 'rate_limited'
  }
  if (status >= 200 && status < 300) {
    return 'connected'
  }
  return 'failed'
}

function buildRequest(
  protocol: AiProtocol,
  baseUrl: string,
  model: string,
  apiKey: string,
): { url: string; headers: Record<string, string>; body: unknown } {
  const root = baseUrl.replace(/\/$/, '')
  if (protocol === 'anthropic') {
    return {
      url: `${root}/v1/messages`,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      },
    }
  }
  if (protocol === 'gemini') {
    return {
      url: `${root}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1 },
      },
    }
  }
  return {
    url: `${root}/chat/completions`,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: {
      model,
      max_tokens: 1,
      temperature: 0,
      messages: [{ role: 'user', content: 'ping' }],
    },
  }
}

/** 连接探测:只判断鉴权与可达性,不解析业务输出,也不回显请求细节。 */
export async function probeProviderConnection(
  input: ProviderProbeInput,
): Promise<ProviderProbeResult> {
  const timeoutMs = input.timeoutMs ?? 8_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const request = buildRequest(
    input.protocol,
    input.baseUrl || AI_PROTOCOL_DEFAULT_BASE_URL[input.protocol],
    input.model,
    input.apiKey,
  )
  try {
    const fetchImpl = input.fetchImpl ?? createProviderFetch(input.trustedOrigins ?? [])
    const response = await fetchImpl(
      request.url,
      providerRequestInit({
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal,
      }),
    )
    // 读取并丢弃正文,避免连接复用残留,且绝不把正文返回给调用方。
    await response.text().catch(() => undefined)
    const code = classifyStatus(response.status)
    return { ok: code === 'connected', code, message: MESSAGES[code] }
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'AbortError' || name === 'TimeoutError') {
      return { ok: false, code: 'timeout', message: MESSAGES.timeout }
    }
    return { ok: false, code: 'failed', message: MESSAGES.failed }
  } finally {
    clearTimeout(timer)
  }
}
