import { describe, expect, it, vi } from 'vitest'
import { FakeHttpTransport } from '../http/fake-http-transport'
import { createServices } from './index'

describe('createServices', () => {
  it('selects the REST adapter from the transport discriminator', () => {
    const services = createServices({
      transport: 'rest',
      httpTransport: new FakeHttpTransport(() => ({})),
    })

    expect(services.topics).toBeDefined()
    expect(services.studySessions).toBeDefined()
    expect(services.learningLogs).toBeDefined()
  })

  it('selects the oRPC adapter without changing the public service shape', () => {
    const rawClient = {
      studySessions: {
        start: vi.fn(),
        active: vi.fn(),
        byId: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        complete: vi.fn(),
      },
      topics: { listActive: vi.fn() },
      learningLogs: { list: vi.fn(), bySession: vi.fn(), update: vi.fn() },
    }

    const services = createServices({ transport: 'orpc', orpcClient: rawClient })

    expect(Object.keys(services).sort()).toEqual(['learningLogs', 'studySessions', 'topics'])
  })
})
