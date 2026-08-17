// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isTrustedIpcSender } from './validate-ipc-sender'

describe('isTrustedIpcSender', () => {
  it('accepts the configured desktop renderer origin in development', () => {
    expect(
      isTrustedIpcSender(
        {
          senderFrame: {
            url: 'http://localhost:5173/src/renderer/index.html',
            isDestroyed: () => false,
          },
        },
        { isDev: true, rendererDevOrigin: 'http://localhost:5173' },
      ),
    ).toBe(true)
  })

  it('rejects destroyed frames and foreign origins', () => {
    expect(
      isTrustedIpcSender(
        { senderFrame: { url: 'http://localhost:5173/', isDestroyed: () => true } },
        { isDev: true, rendererDevOrigin: 'http://localhost:5173' },
      ),
    ).toBe(false)
    expect(
      isTrustedIpcSender(
        { senderFrame: { url: 'https://evil.example', isDestroyed: () => false } },
        { isDev: true, rendererDevOrigin: 'http://localhost:5173' },
      ),
    ).toBe(false)
  })

  it('only allows file origins in production', () => {
    expect(
      isTrustedIpcSender(
        {
          senderFrame: {
            url: 'file:///Applications/StudyCommit.app/index.html',
            isDestroyed: () => false,
          },
        },
        { isDev: false },
      ),
    ).toBe(true)
    expect(
      isTrustedIpcSender(
        { senderFrame: { url: 'http://localhost:5173/', isDestroyed: () => false } },
        { isDev: false },
      ),
    ).toBe(false)
  })
})
