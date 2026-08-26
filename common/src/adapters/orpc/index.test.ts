import { describe, expect, it, vi } from 'vitest'
import { createOrpcServices, type OrpcRawClient } from './index'

describe('createOrpcServices', () => {
  it('maps generated procedures through stable business ports', async () => {
    const client: OrpcRawClient = {
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

    const services = createOrpcServices(client)

    const input = { topicId: 'topic', limit: 20 }
    await services.topics.listActive(input)
    expect(client.topics.listActive).toHaveBeenCalledWith(input)

    const sessionInput = { topicId: 'topic', goal: null, idempotencyKey: 'key' }
    await services.studySessions.create(sessionInput)
    expect(client.studySessions.start).toHaveBeenCalledWith(sessionInput)

    await services.studySessions.getActive()
    expect(client.studySessions.active).toHaveBeenCalledWith(undefined)

    const sessionId = 'session'
    await services.studySessions.getById(sessionId)
    expect(client.studySessions.byId).toHaveBeenCalledWith(sessionId)

    const logId = 'log'
    await services.learningLogs.getBySession(sessionId)
    expect(client.learningLogs.bySession).toHaveBeenCalledWith(sessionId)
    expect(services).toHaveProperty('learningLogs.update')
    expect(services).toHaveProperty('learningLogs.list')
    expect(logId).toBe('log')
  })
})
