import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '@studycommit/common/http'
import {
  createMiniProgramHttpClient,
  type MiniProgramRequestOption,
  type MiniProgramRequestPromise,
} from './http'

function createRequestMock() {
  let option: MiniProgramRequestOption | undefined
  const task = { abort: vi.fn() }
  const request = vi.fn((nextOption: MiniProgramRequestOption) => {
    option = nextOption
    return task
  })
  return { request, getOption: () => option, task }
}

function response(statusCode: number, data: unknown, header: Record<string, string> = {}) {
  return { statusCode, data, header }
}

describe('mini program http client', () => {
  it('builds a JSON request with auth and correlation headers', async () => {
    const mock = createRequestMock()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
      getToken: () => 'secret-token',
      createRequestId: () => 'req-001',
    })

    const promise = client.request<{ ok: boolean }>({
      method: 'POST',
      path: '/notes',
      data: { content: 'hello' },
      parse: (data) => data as { ok: boolean },
    })
    mock.getOption()?.success?.(response(201, { ok: true }, { 'x-request-id': 'req-001' }))

    await expect(promise).resolves.toEqual({ ok: true })
    expect(mock.getOption()).toMatchObject({
      url: 'https://api.example.com/api/notes',
      method: 'POST',
      data: { content: 'hello' },
      timeout: 10000,
      header: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: 'Bearer secret-token',
        'X-Request-Id': 'req-001',
      },
    })
  })

  it('does not send an authorization header when there is no token', async () => {
    const mock = createRequestMock()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
      getToken: () => undefined,
    })

    const promise = client.request({ method: 'GET', path: '/health' })
    mock.getOption()?.success?.(response(200, { status: 'ok' }))

    await expect(promise).resolves.toEqual({ status: 'ok' })
    expect(mock.getOption()?.header).not.toHaveProperty('Authorization')
  })

  it('uses the resolved GET method when building headers and query data', async () => {
    const mock = createRequestMock()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
    })

    const promise = client.request({ method: undefined, path: '/notes', data: { page: 1 } })
    mock.getOption()?.success?.(response(200, { ok: true }))

    await expect(promise).resolves.toEqual({ ok: true })
    expect(mock.getOption()).toMatchObject({
      method: 'GET',
      data: { page: 1 },
    })
    expect(mock.getOption()?.header).not.toHaveProperty('content-type')
  })

  it('rejects invalid paths before calling wx.request', async () => {
    const mock = createRequestMock()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
    })

    await expect(
      client.request({ method: 'GET', path: 'https://evil.example.com' }),
    ).rejects.toMatchObject({
      serialized: { code: 'INVALID_RESPONSE' },
    })
    expect(mock.request).not.toHaveBeenCalled()
  })

  it('maps backend errors and preserves request id without leaking response data', async () => {
    const mock = createRequestMock()
    const captureError = vi.fn()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
      monitor: { captureError },
    })

    const promise = client.request({ method: 'GET', path: '/notes' })
    mock.getOption()?.success?.(
      response(409, {
        error: {
          code: 'NOTE_CONFLICT',
          message: '笔记版本冲突',
          details: { token: 'secret-token' },
        },
        requestId: 'req-409',
      }),
    )

    await expect(promise).rejects.toMatchObject({
      serialized: {
        code: 'CONFLICT',
        backendCode: 'NOTE_CONFLICT',
        requestId: 'req-409',
      },
    })
    expect(captureError).toHaveBeenCalledWith(
      expect.any(HttpError),
      expect.objectContaining({ path: '/notes' }),
    )
    expect(JSON.stringify(captureError.mock.calls[0])).not.toContain('secret-token')
  })

  it('maps timeout and network failures to stable HttpError codes', async () => {
    const timeoutMock = createRequestMock()
    const timeoutClient = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: timeoutMock.request,
    })
    const timeoutPromise = timeoutClient.request({ method: 'GET', path: '/slow' })
    timeoutMock.getOption()?.fail?.({ errMsg: 'request:fail timeout' })
    await expect(timeoutPromise).rejects.toMatchObject({ serialized: { code: 'TIMEOUT' } })

    const networkMock = createRequestMock()
    const networkClient = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: networkMock.request,
    })
    const networkPromise = networkClient.request({ method: 'GET', path: '/offline' })
    networkMock.getOption()?.fail?.({ errMsg: 'request:fail network unavailable' })
    await expect(networkPromise).rejects.toMatchObject({ serialized: { code: 'NETWORK_ERROR' } })
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid timeout %s before sending a request',
    async (timeoutMs) => {
      const mock = createRequestMock()
      const client = createMiniProgramHttpClient({
        baseUrl: 'https://api.example.com',
        requestImpl: mock.request,
      })

      await expect(
        client.request({ method: 'GET', path: '/slow', timeoutMs }),
      ).rejects.toMatchObject({
        serialized: { code: 'CONFIGURATION_ERROR' },
      })
      expect(mock.request).not.toHaveBeenCalled()
    },
  )

  it('supports cancellation and does not wait for wx.request to call fail', async () => {
    const mock = createRequestMock()
    const captureError = vi.fn()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
      monitor: { captureError },
    })

    const promise = client.request({
      method: 'GET',
      path: '/slow',
    }) as MiniProgramRequestPromise<unknown>
    promise.cancel()

    await expect(promise).rejects.toMatchObject({ serialized: { code: 'CANCELLED' } })
    expect(mock.task.abort).toHaveBeenCalledOnce()
    expect(captureError).toHaveBeenCalledOnce()
  })

  it('rejects immediately when the caller signal is already aborted', async () => {
    const mock = createRequestMock()
    const controller = new AbortController()
    controller.abort()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
    })

    await expect(
      client.request({ method: 'GET', path: '/notes', signal: controller.signal }),
    ).rejects.toMatchObject({ serialized: { code: 'CANCELLED' } })
    expect(mock.request).not.toHaveBeenCalled()
  })

  it('maps an unexpected transport exception to UNKNOWN instead of NETWORK_ERROR', async () => {
    const request = vi.fn(() => {
      throw new Error('transport implementation failed')
    })
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: request,
    })

    await expect(client.request({ method: 'GET', path: '/notes' })).rejects.toMatchObject({
      serialized: { code: 'UNKNOWN' },
    })
  })

  it('maps invalid success payloads and 204 responses through the parser', async () => {
    const invalidMock = createRequestMock()
    const invalidClient = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: invalidMock.request,
    })
    const invalidPromise = invalidClient.request({
      method: 'GET',
      path: '/notes',
      parse: () => {
        throw new Error('字段缺失')
      },
    })
    invalidMock.getOption()?.success?.(response(200, {}))
    await expect(invalidPromise).rejects.toMatchObject({
      serialized: { code: 'INVALID_RESPONSE', status: 200 },
    })

    const emptyMock = createRequestMock()
    const emptyClient = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: emptyMock.request,
    })
    const emptyPromise = emptyClient.request({ method: 'DELETE', path: '/notes/1' })
    emptyMock.getOption()?.success?.(response(204, undefined))
    await expect(emptyPromise).resolves.toBeUndefined()
  })

  it('does not let monitor failures change the request result', async () => {
    const mock = createRequestMock()
    const client = createMiniProgramHttpClient({
      baseUrl: 'https://api.example.com',
      requestImpl: mock.request,
      monitor: {
        captureError: vi.fn(() => {
          throw new Error('monitor unavailable')
        }),
      },
    })

    const promise = client.request({ method: 'GET', path: '/notes' })
    mock.getOption()?.fail?.({ errMsg: 'request:fail network unavailable' })

    await expect(promise).rejects.toMatchObject({ serialized: { code: 'NETWORK_ERROR' } })
  })
})
