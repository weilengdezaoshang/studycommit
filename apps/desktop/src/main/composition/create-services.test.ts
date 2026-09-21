// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '@studycommit/common/http'
import { net } from 'electron'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/studycommit-test' },
  net: { fetch: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => false },
}))

import { createMemorySessionPersist, DesktopAuthSessionStore } from '../auth/session-store'
import { createDesktopServices, resolveDesktopServices } from './create-services'

describe('createDesktopServices', () => {
  it('默认请求适配器向 Electron 传递完整请求并保留地址请求头与正文', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    vi.mocked(net.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: '11111111-1111-4111-8111-111111111111',
            nickname: '学习者',
            avatarUrl: null,
            status: 'active',
          },
          tokens: { accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    )
    const services = createDesktopServices(
      { STUDYCOMMIT_API_ORIGIN: 'http://127.0.0.1:3000', NODE_ENV: 'development' },
      { sessionStore: new DesktopAuthSessionStore(createMemorySessionPersist()) },
    )
    await services.auth.loginAccount('demo', 'test-password')
    const [request] = vi.mocked(net.fetch).mock.calls.at(-1)!
    expect(request).toBeInstanceOf(Request)
    const sent = request as Request
    expect(sent.url).toBe('http://127.0.0.1:3000/api/auth/account/login')
    expect(sent.method).toBe('POST')
    expect(sent.headers.get('content-type')).toContain('application/json')
    expect(await sent.json()).toEqual({
      account: 'demo',
      password: 'test-password',
      deviceType: 'desktop',
    })
    vi.mocked(net.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ session: null, serverNow: expiresAt }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
    await services.studySessions.getActive()
    const [authenticatedRequest] = vi.mocked(net.fetch).mock.calls.at(-1)!
    expect(authenticatedRequest).toBeInstanceOf(Request)
    expect((authenticatedRequest as Request).headers.get('authorization')).toBe(
      'Bearer test-access',
    )
  })

  it('maps missing origin to CONFIGURATION_ERROR', () => {
    expect(() => createDesktopServices({ NODE_ENV: 'development' })).toThrow(HttpError)
    try {
      createDesktopServices({ NODE_ENV: 'development' })
    } catch (error) {
      expect(error).toMatchObject({ serialized: { code: 'CONFIGURATION_ERROR' } })
    }
  })

  it('still exposes session handlers when configuration is missing', async () => {
    const services = resolveDesktopServices({ NODE_ENV: 'development' })
    await expect(services.studySessions.getActive()).rejects.toMatchObject({
      serialized: { code: 'CONFIGURATION_ERROR' },
    })
    await expect(
      services.learningLogs.getBySession('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({
      serialized: { code: 'CONFIGURATION_ERROR' },
    })
  })

  it('登录后的业务请求带上 Authorization', async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.endsWith('/auth/account/login')) {
        return new Response(
          JSON.stringify({
            user: {
              id: '11111111-1111-4111-8111-111111111111',
              nickname: '学习者',
              avatarUrl: null,
              status: 'active',
            },
            tokens: {
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresAt,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ session: null, serverNow: expiresAt }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const services = createDesktopServices(
      { STUDYCOMMIT_API_ORIGIN: 'http://127.0.0.1:3000', NODE_ENV: 'development' },
      {
        fetchImpl: fetchImpl as typeof fetch,
        sessionStore: new DesktopAuthSessionStore(createMemorySessionPersist()),
      },
    )
    await services.auth.loginAccount('demo', 'secret123')
    await services.studySessions.getActive()
    const request = fetchImpl.mock.calls[1]?.[0]
    expect(request).toBeInstanceOf(Request)
    expect((request as Request).headers.get('authorization')).toBe('Bearer access-token')
  })
})
