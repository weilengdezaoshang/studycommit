// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '@studycommit/common/http'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/studycommit-test' },
  net: { fetch: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => false },
}))

import { createMemorySessionPersist, DesktopAuthSessionStore } from '../auth/session-store'
import { createDesktopServices, resolveDesktopServices } from './create-services'

describe('createDesktopServices', () => {
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
      const url = String(input)
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
    const headers = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer access-token')
  })
})
