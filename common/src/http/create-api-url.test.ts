import { describe, expect, it } from 'vitest'
import { createApiUrl } from './create-api-url'
import { HttpError } from './http-error'

describe('createApiUrl', () => {
  it('keeps the API prefix', () => {
    expect(
      createApiUrl({
        origin: 'http://localhost:3000',
        apiPrefix: '/api',
        path: '/study-sessions/active',
        allowInsecureHttp: true,
      }).href,
    ).toBe('http://localhost:3000/api/study-sessions/active')
  })

  it('normalizes prefix slashes', () => {
    expect(
      createApiUrl({
        origin: 'https://api.example.com',
        apiPrefix: 'api/',
        path: '/study-sessions',
      }).href,
    ).toBe('https://api.example.com/api/study-sessions')
  })

  it.each([
    'https://evil.example.com/study-sessions',
    '//evil.example.com',
    '../admin',
    'javascript:alert(1)',
  ])('rejects %s', (path) => {
    expect(() =>
      createApiUrl({
        origin: 'https://api.example.com',
        apiPrefix: '/api',
        path,
      }),
    ).toThrow(HttpError)
  })

  it('rejects production HTTP origins', () => {
    expect(() =>
      createApiUrl({
        origin: 'http://localhost:3000',
        apiPrefix: '/api',
        path: '/study-sessions/active',
      }),
    ).toThrow(/HTTPS/)
  })

  it('rejects origins that include a business path', () => {
    expect(() =>
      createApiUrl({
        origin: 'https://api.example.com/api',
        apiPrefix: '/api',
        path: '/study-sessions/active',
      }),
    ).toThrow(HttpError)
  })
})
