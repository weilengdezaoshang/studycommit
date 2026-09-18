import { EventSourceParserStream } from 'eventsource-parser/stream'
import type { AiCompletionRequest, AiProtocol, AiProviderOptions } from './ai-provider'
import { providerRequestInit } from './provider-http'

/** 只转发最终正文的增量，不展示供应商的推理过程。 */
export async function* streamProvider(
  protocol: AiProtocol,
  options: AiProviderOptions,
  request: AiCompletionRequest,
): AsyncGenerator<string> {
  const timeout = AbortSignal.timeout(request.timeoutMs ?? options.timeoutMs ?? 60000)
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
  const base = options.baseUrl.replace(/\/$/, '')
  let url = `${base}/chat/completions`
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
  }
  let body: Record<string, unknown>
  if (protocol === 'anthropic') {
    url = `${base}/v1/messages`
    headers['x-api-key'] = options.apiKey
    headers['anthropic-version'] = '2023-06-01'
    body = {
      model: options.model,
      stream: true,
      max_tokens: 2048,
      system: request.system,
      messages: [{ role: 'user', content: request.user }],
    }
  } else if (protocol === 'gemini') {
    url = `${base}/v1beta/models/${encodeURIComponent(options.model)}:streamGenerateContent?alt=sse`
    headers['x-goog-api-key'] = options.apiKey
    body = {
      system_instruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: [{ text: request.user }] }],
    }
  } else {
    headers.authorization = `Bearer ${options.apiKey}`
    body = {
      model: options.model,
      stream: true,
      temperature: request.temperature ?? 0.3,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
    }
  }
  const response = await (options.fetchImpl ?? fetch)(
    url,
    providerRequestInit({
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    }),
  )
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    const reason: Record<number, string> = {
      401: 'API 密钥无效，请检查设置。',
      402: 'AI 账户余额不足。',
      403: '当前密钥没有模型访问权限。',
      404: '模型或接口地址不存在，请检查设置。',
      429: '请求过于频繁或额度不足，请稍后重试。',
    }
    throw new Error(reason[response.status] ?? `AI 服务暂时不可用（${response.status}），请重试。`)
  }
  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader()
  let finished = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
break
}
      if (value.data === '[DONE]') {
        finished = true
        break
      }
      const data = JSON.parse(value.data)
      if (data.error || data.type === 'error') {
throw new Error('AI 流式响应失败，请重试。')
}
      let text: unknown
      if (protocol === 'anthropic') {
        if (data.type === 'message_stop') {
finished = true
}
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
text = data.delta.text
}
      } else if (protocol === 'gemini') {
        const candidate = data.candidates?.[0]
        if (candidate?.finishReason === 'STOP') {
finished = true
}
        text = candidate?.content?.parts
          ?.filter((p: { thought?: boolean; text?: string }) => !p.thought)
          .map((p: { text?: string }) => p.text ?? '')
          .join('')
      } else {
        if (data.choices?.[0]?.finish_reason === 'stop') {
finished = true
}
        text = data.choices?.[0]?.delta?.content
      }
      if (typeof text === 'string' && text) {
yield text
}
    }
    if (!finished) {
throw new Error('解释连接中断，已接收内容保留，请重试。')
}
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
