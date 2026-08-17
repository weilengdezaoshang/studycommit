import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('StudySessions API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const user = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const headers = (key = crypto.randomUUID(), owner = user) => ({
    'x-user-id': owner,
    'idempotency-key': key,
  })

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory')
    app = await module.createApp()
  })
  beforeEach(async () => {
    await pool.query('truncate study_sessions, idempotency_records, topics')
  })
  afterAll(async () => {
    await app.close()
    await pool.end()
  })

  async function createTopic() {
    return (
      await app.inject({
        method: 'POST',
        url: '/api/topics',
        headers: headers(),
        payload: { name: 'Node.js', color: '#4F46E5' },
      })
    ).json()
  }

  it('starts, pauses, resumes and completes one shared session', async () => {
    const topic = await createTopic()
    const started = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('start'),
      payload: { topicId: topic.id, goal: '学习事务' },
    })
    expect(started.statusCode).toBe(201)
    const session = started.json()

    const active = (
      await app.inject({
        method: 'GET',
        url: '/api/study-sessions/active',
        headers: { 'x-user-id': user },
      })
    ).json()
    expect(active.session).toMatchObject({ id: session.id, status: 'running', version: 1 })
    expect(active.serverNow).toBeTruthy()

    const paused = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/pause`,
        headers: headers('pause'),
        payload: { version: 1 },
      })
    ).json()
    expect(paused).toMatchObject({ status: 'paused', version: 2 })
    const resumed = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/resume`,
        headers: headers('resume'),
        payload: { version: 2 },
      })
    ).json()
    expect(resumed).toMatchObject({ status: 'running', version: 3 })
    const completed = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/complete`,
        headers: headers('complete'),
        payload: { version: 3 },
      })
    ).json()
    expect(completed).toMatchObject({
      status: 'completed',
      version: 4,
      completionSource: 'online',
    })
    expect(completed.durationSeconds).toBeGreaterThanOrEqual(0)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/study-sessions/active',
          headers: { 'x-user-id': user },
        })
      ).json().session,
    ).toBeNull()
  })

  it('replays a command and prevents deleting a topic with an active session', async () => {
    const topic = await createTopic()
    const first = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('same-start'),
      payload: { topicId: topic.id },
    })
    const replay = await app.inject({
      method: 'POST',
      url: '/api/study-sessions',
      headers: headers('same-start'),
      payload: { topicId: topic.id },
    })
    expect(replay.json().id).toBe(first.json().id)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': user, 'if-match': '1' },
    })
    expect(removed.statusCode).toBe(409)
    expect(removed.json().error.code).toBe('TOPIC_HAS_ACTIVE_SESSION')
  })

  it('serializes concurrent starts and duplicate pause commands', async () => {
    const topic = await createTopic()
    const starts = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers('start-a'),
        payload: { topicId: topic.id },
      }),
      app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers('start-b'),
        payload: { topicId: topic.id },
      }),
    ])
    expect(starts.map((response) => response.statusCode).sort()).toEqual([201, 409])
    const session = starts.find((response) => response.statusCode === 201)!.json()

    const pauses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/pause`,
        headers: headers('same-pause'),
        payload: { version: 1 },
      }),
      app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/pause`,
        headers: headers('same-pause'),
        payload: { version: 1 },
      }),
    ])
    expect(pauses.map((response) => response.statusCode)).toEqual([201, 201])
    expect(pauses[0].json()).toMatchObject({ status: 'paused', version: 2 })
    expect(pauses[1].json().pausedAt).toBe(pauses[0].json().pausedAt)
  })

  it('does not count the current paused interval when completing', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/pause`,
      headers: headers(),
      payload: { version: 1 },
    })
    await pool.query(
      "update study_sessions set started_at = now() - interval '2 hours', paused_at = now() - interval '1 hour' where id = $1",
      [session.id],
    )
    const completed = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/complete`,
        headers: headers(),
        payload: { version: 2 },
      })
    ).json()
    expect(completed.status).toBe('completed')
    expect(completed.durationSeconds).toBeGreaterThanOrEqual(3599)
    expect(completed.durationSeconds).toBeLessThanOrEqual(3601)
  })

  it('isolates sessions and rejects unusable topics', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/study-sessions/${session.id}`,
          headers: { 'x-user-id': other },
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/study-sessions/${session.id}/pause`,
          headers: headers(crypto.randomUUID(), other),
          payload: { version: 1 },
        })
      ).statusCode,
    ).toBe(404)

    const archived = await createTopic()
    await app.inject({
      method: 'PATCH',
      url: `/api/topics/${archived.id}`,
      headers: { 'x-user-id': user },
      payload: { status: 'archived', version: 1 },
    })
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/study-sessions',
          headers: headers(),
          payload: { topicId: archived.id },
        })
      ).json().error.code,
    ).toBe('TOPIC_NOT_FOUND')

    const foreign = (
      await app.inject({
        method: 'POST',
        url: '/api/topics',
        headers: headers(crypto.randomUUID(), other),
        payload: { name: 'Other', color: '#000000' },
      })
    ).json()
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/study-sessions',
          headers: headers(),
          payload: { topicId: foreign.id },
        })
      ).json().error.code,
    ).toBe('TOPIC_NOT_FOUND')

    const deleted = await createTopic()
    await app.inject({
      method: 'DELETE',
      url: `/api/topics/${deleted.id}`,
      headers: { 'x-user-id': user, 'if-match': '1' },
    })
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/study-sessions',
          headers: headers(),
          payload: { topicId: deleted.id },
        })
      ).json().error.code,
    ).toBe('TOPIC_NOT_FOUND')
  })

  it('allows deleting a topic after the session is completed', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers(),
      payload: { version: 1 },
    })
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': user, 'if-match': '1' },
    })
    expect(removed.statusCode).toBe(204)
  })

  it('accepts offline completion and rejects an end time before start', async () => {
    const topic = await createTopic()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(),
        payload: { topicId: topic.id },
      })
    ).json()
    const tooEarly = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers(),
      payload: {
        version: 1,
        completionSource: 'offline_sync',
        endedAt: new Date(Date.parse(session.startedAt) - 60_000).toISOString(),
      },
    })
    expect(tooEarly.statusCode).toBe(400)
    expect(tooEarly.json().error.code).toBe('INVALID_SESSION_END_TIME')

    const completed = await app.inject({
      method: 'POST',
      url: `/api/study-sessions/${session.id}/complete`,
      headers: headers(),
      payload: {
        version: 1,
        completionSource: 'offline_sync',
        endedAt: new Date(Date.parse(session.startedAt) + 2000).toISOString(),
      },
    })
    expect(completed.statusCode).toBe(201)
    expect(completed.json()).toMatchObject({
      status: 'completed',
      completionSource: 'offline_sync',
    })
  })
})
