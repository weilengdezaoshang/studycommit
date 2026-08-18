// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpError } from '@studycommit/common/http'

const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) => {
      handlers.set(channel, listener)
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel)
    }),
  },
}))

import { IpcHost, parseIpcInput } from './ipc-host'

function trustedEvent() {
  return {
    sender: { isDestroyed: () => false },
    senderFrame: { url: 'http://localhost:5173/index.html', isDestroyed: () => false },
  }
}

describe('IpcHost', () => {
  const trust = {
    isDev: true,
    rendererDevOrigin: 'http://localhost:5173',
  }

  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it('wraps handlers with trust, success, and failure results', async () => {
    const host = new IpcHost(trust)
    host.handle('demo:ok', async (value) => value)
    host.handle('demo:fail', async () => {
      throw createHttpError({ code: 'CONFLICT', message: '冲突' })
    })

    await expect(handlers.get('demo:ok')?.(trustedEvent(), 'payload')).resolves.toEqual({
      ok: true,
      data: 'payload',
    })
    await expect(
      handlers.get('demo:ok')?.({
        sender: { isDestroyed: () => false },
        senderFrame: { url: 'https://evil.example', isDestroyed: () => false },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    await expect(handlers.get('demo:fail')?.(trustedEvent())).resolves.toMatchObject({
      ok: false,
      error: { code: 'CONFLICT', message: '冲突' },
    })
  })

  it('serializes unknown failures without leaking internals', async () => {
    const host = new IpcHost(trust)
    host.handle('demo:secret', async () => {
      throw new Error('secret stack token=abc')
    })
    const unknown = await handlers.get('demo:secret')?.(trustedEvent())
    expect(JSON.stringify(unknown)).not.toContain('token=abc')
    expect(unknown).toMatchObject({ ok: false, error: { code: 'UNKNOWN' } })
  })

  it('does not throw when the caller window is gone', async () => {
    const sender = { closed: false, isDestroyed: () => sender.closed }
    const senderFrame = {
      url: 'http://localhost:5173/index.html',
      closed: false,
      isDestroyed: () => senderFrame.closed,
    }
    const host = new IpcHost(trust)
    host.handle('demo:slow', async () => {
      sender.closed = true
      senderFrame.closed = true
      return 'late'
    })
    const result = await handlers.get('demo:slow')?.({ sender, senderFrame })
    expect(result).toMatchObject({ ok: false, error: { code: 'CANCELLED' } })
  })

  it('replaces a channel on re-handle and removes every channel on dispose', () => {
    const host = new IpcHost(trust)
    host.handle('demo:a', async () => 'first')
    host.handle('demo:a', async () => 'second')
    host.handle('demo:b', async () => 'other')
    expect(handlers.size).toBe(2)
    host.dispose()
    expect(handlers.size).toBe(0)
    host.dispose()
    expect(handlers.size).toBe(0)
  })
})

describe('parseIpcInput', () => {
  it('returns parsed data or throws INVALID_RESPONSE', () => {
    const schema = {
      safeParse: (value: unknown) =>
        value === 'ok' ? { success: true as const, data: value } : { success: false as const },
    }
    expect(parseIpcInput(schema, 'ok')).toBe('ok')
    try {
      parseIpcInput(schema, 'bad')
      throw new Error('expected parseIpcInput to throw')
    } catch (error) {
      expect(error).toMatchObject({ serialized: { code: 'INVALID_RESPONSE' } })
    }
  })
})
