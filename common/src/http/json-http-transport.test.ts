import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { studySessionSchema } from '../contracts/study-session'
import { runningStudySessionFixture } from '../contracts/study-session/study-session.fixture'
import { HttpError } from './http-error'
import { JsonHttpTransport } from './json-http-transport'

const sessionSchema = studySessionSchema
const logs: Array<{ message: string; data?: Record<string, unknown> }> = []

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function transport(fetchImpl: typeof fetch) {
  return new JsonHttpTransport({
    origin: 'http://localhost:3000',
    apiPrefix: '/api',
    fetchImpl,
    getHeaders: async () => ({ 'X-User-Id': '11111111-1111-4111-8111-111111111111' }),
    defaultTimeoutMs: 50,
    allowInsecureHttp: true,
    onLog: (event) => logs.push(event),
  })
}

describe('JsonHttpTransport', () => {
  it('parses a successful session and does not send GET bodies', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(init?.body).toBeUndefined()
      return jsonResponse(200, runningStudySessionFixture)
    })
    await expect(
      transport(fetchImpl).request({
        method: 'GET',
        path: '/study-sessions/active-id'.replace('active-id', runningStudySessionFixture.id),
        responseSchema: sessionSchema,
      }),
    ).resolves.toMatchObject({ id: runningStudySessionFixture.id })
  })

  it('serializes POST JSON once', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({ version: 1 })
      return jsonResponse(200, runningStudySessionFixture)
    })
    await transport(fetchImpl).request({
      method: 'POST',
      path: `/study-sessions/${runningStudySessionFixture.id}/pause`,
      body: { version: 1 },
      responseSchema: sessionSchema,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('maps 204 to INVALID_RESPONSE when a session is expected', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    await expect(
      transport(fetchImpl).request({
        method: 'POST',
        path: '/study-sessions',
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({ serialized: { code: 'INVALID_RESPONSE', status: 204 } })
  })

  it('keeps backend conflict details', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, {
        error: {
          code: 'SESSION_VERSION_CONFLICT',
          message: '学习会话版本冲突',
          details: { session: runningStudySessionFixture },
        },
        requestId: 'req-1',
        timestamp: '2026-08-17T08:00:00.000Z',
        path: '/api/study-sessions/1/pause',
      }),
    )
    await expect(
      transport(fetchImpl).request({
        method: 'POST',
        path: `/study-sessions/${runningStudySessionFixture.id}/pause`,
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({
      serialized: {
        code: 'CONFLICT',
        backendCode: 'SESSION_VERSION_CONFLICT',
        requestId: 'req-1',
        details: { session: runningStudySessionFixture },
      },
    })
  })

  it('maps HTML success and invalid JSON to INVALID_RESPONSE', async () => {
    const html = vi.fn(async () => new Response('<html>oops</html>', { status: 200 }))
    await expect(
      transport(html).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({ serialized: { code: 'INVALID_RESPONSE' } })

    const invalid = vi.fn(
      async () =>
        new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    await expect(
      transport(invalid).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({ serialized: { code: 'INVALID_RESPONSE' } })
  })

  it('maps schema mismatches to INVALID_RESPONSE', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { ...runningStudySessionFixture, status: 'unknown' }),
    )
    await expect(
      transport(fetchImpl).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({ serialized: { code: 'INVALID_RESPONSE' } })
  })

  it('maps timeout and user cancel separately', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const signal = init?.signal
      await new Promise((_, reject) => {
        const fail = () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        }
        if (signal?.aborted) {
          fail()
          return
        }
        signal?.addEventListener('abort', fail, { once: true })
      })
      return jsonResponse(200, runningStudySessionFixture)
    })
    await expect(
      transport(fetchImpl).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        timeoutMs: 10,
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({ serialized: { code: 'TIMEOUT' } })

    const user = new AbortController()
    user.abort()
    await expect(
      transport(fetchImpl).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        signal: user.signal,
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({ serialized: { code: 'CANCELLED' } })
  })

  it('maps connection failures to NETWORK_ERROR', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(
      transport(fetchImpl).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        responseSchema: sessionSchema,
      }),
    ).rejects.toMatchObject({ serialized: { code: 'NETWORK_ERROR' } })
  })

  it('does not log sensitive headers in any casing', async () => {
    logs.length = 0
    const fetchImpl = vi.fn(async () => new Response('<html>gateway</html>', { status: 502 }))
    await expect(
      transport(fetchImpl).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        headers: { Authorization: 'Bearer secret', 'X-USER-ID': 'hidden' },
        responseSchema: sessionSchema,
      }),
    ).rejects.toBeInstanceOf(HttpError)
    expect(JSON.stringify(logs)).not.toMatch(/Bearer secret|hidden/i)
  })

  it('does not leak illegal error HTML', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('<html>internal stack token=abc</html>', { status: 500 }),
    )
    try {
      await transport(fetchImpl).request({
        method: 'GET',
        path: `/study-sessions/${runningStudySessionFixture.id}`,
        responseSchema: sessionSchema,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect(JSON.stringify((error as HttpError).serialized)).not.toContain('<html>')
      expect(JSON.stringify((error as HttpError).serialized)).not.toContain('token=abc')
    }
  })

  it('accepts nullable schemas for 204', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    await expect(
      transport(fetchImpl).request({
        method: 'DELETE',
        path: '/study-sessions/unused',
        responseSchema: z.null(),
      }),
    ).resolves.toBeNull()
  })
})
