import { describe, expect, it, vi } from 'vitest'
import { TopicsService } from './topics.service'
const input = { name: 'Node', color: '#4F46E5', status: 'active' as const }
describe('TopicsService', () => {
  it('rejects an idempotency key reused with different content', async () => {
    const repository = { findIdempotency: vi.fn(), findById: vi.fn() }
    const service = new TopicsService(repository as never)
    repository.findIdempotency.mockResolvedValue({ requestHash: 'different', resourceId: crypto.randomUUID() })
    await expect(service.create(crypto.randomUUID(), input, 'key')).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_REUSED' } })
  })
  it('returns not found without revealing ownership', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null) }
    await expect(new TopicsService(repository as never).get(crypto.randomUUID(), crypto.randomUUID())).rejects.toMatchObject({ response: { code: 'TOPIC_NOT_FOUND' } })
  })
  it('creates a topic and returns the replay flag', async () => {
    const topic = { id: crypto.randomUUID(), ...input }
    const repository = { findIdempotency: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(topic) }
    await expect(new TopicsService(repository as never).create(crypto.randomUUID(), input, 'key')).resolves.toEqual({ topic, replayed: false })
  })
  it('distinguishes missing resources from version conflicts', async () => {
    const repository = { update: vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }) }
    await expect(new TopicsService(repository as never).update(crypto.randomUUID(), crypto.randomUUID(), { name: 'new', version: 1 })).rejects.toMatchObject({ response: { code: 'TOPIC_VERSION_CONFLICT' } })
  })
})
