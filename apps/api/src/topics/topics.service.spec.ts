import { describe, expect, it, vi } from 'vitest'
import { IDEMPOTENCY_ERROR, IDEMPOTENCY_RECORDS_PKEY } from '../common/idempotency'
import { TOPIC_CREATE_KIND, TOPIC_ERROR, TOPIC_REMOVE_KIND } from './topic.constants'
import { TopicsService } from './topics.service'

const input = { name: 'Node', color: '#4F46E5', status: 'active' as const }

describe('TopicsService', () => {
  it('rejects an idempotency key reused with different content', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ kind: TOPIC_CREATE_KIND.idempotencyConflict }),
    }
    await expect(
      new TopicsService(repository as never).create(crypto.randomUUID(), input, 'key'),
    ).rejects.toMatchObject({
      response: { code: IDEMPOTENCY_ERROR.keyReused.code },
    })
  })

  it('returns not found without revealing ownership', async () => {
    const repository = { findById: vi.fn().mockResolvedValue(null) }
    await expect(
      new TopicsService(repository as never).get(crypto.randomUUID(), crypto.randomUUID()),
    ).rejects.toMatchObject({
      response: { code: TOPIC_ERROR.notFound.code },
    })
  })

  it('creates a topic and returns the replay flag', async () => {
    const topic = { id: crypto.randomUUID(), ...input }
    const repository = {
      create: vi.fn().mockResolvedValue({ kind: TOPIC_CREATE_KIND.ok, topic, replayed: false }),
    }
    await expect(
      new TopicsService(repository as never).create(crypto.randomUUID(), input, 'key'),
    ).resolves.toEqual({
      topic,
      replayed: false,
    })
  })

  it('retries create after a wrapped idempotency unique conflict', async () => {
    const topic = { id: crypto.randomUUID(), ...input }
    const wrapped = Object.assign(new Error('Failed query'), {
      cause: Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: IDEMPOTENCY_RECORDS_PKEY,
      }),
    })
    const repository = {
      create: vi
        .fn()
        .mockRejectedValueOnce(wrapped)
        .mockResolvedValueOnce({ kind: TOPIC_CREATE_KIND.ok, topic, replayed: true }),
    }
    await expect(
      new TopicsService(repository as never).create(crypto.randomUUID(), input, 'key'),
    ).resolves.toEqual({
      topic,
      replayed: true,
    })
    expect(repository.create).toHaveBeenCalledTimes(2)
  })

  it('distinguishes missing resources from version conflicts', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }),
    }
    await expect(
      new TopicsService(repository as never).update(crypto.randomUUID(), crypto.randomUUID(), {
        name: 'new',
        version: 1,
      }),
    ).rejects.toMatchObject({
      response: { code: TOPIC_ERROR.versionConflict.code },
    })
  })

  it('prevents deleting a topic with an active study session', async () => {
    const repository = {
      remove: vi.fn().mockResolvedValue({ kind: TOPIC_REMOVE_KIND.activeSession }),
    }
    await expect(
      new TopicsService(repository as never).remove(crypto.randomUUID(), crypto.randomUUID(), 1),
    ).rejects.toMatchObject({
      response: { code: TOPIC_ERROR.hasActiveSession.code },
    })
  })

  it('maps a stale delete to a version conflict', async () => {
    const repository = {
      remove: vi.fn().mockResolvedValue({ kind: TOPIC_REMOVE_KIND.versionConflict }),
    }
    await expect(
      new TopicsService(repository as never).remove(crypto.randomUUID(), crypto.randomUUID(), 1),
    ).rejects.toMatchObject({
      response: { code: TOPIC_ERROR.versionConflict.code },
    })
  })
})
