import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('LearningLogs API', () => {
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
    await pool.query('truncate learning_logs, study_sessions, idempotency_records, topics')
  })
  afterAll(async () => {
    await app.close()
    await pool.end()
  })

  async function completeSession(owner = user) {
    const topic = (
      await app.inject({
        method: 'POST',
        url: '/api/topics',
        headers: headers(crypto.randomUUID(), owner),
        payload: { name: 'Node.js', color: '#4F46E5' },
      })
    ).json()
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/study-sessions',
        headers: headers(crypto.randomUUID(), owner),
        payload: { topicId: topic.id, goal: '学习事务' },
      })
    ).json()
    const completed = (
      await app.inject({
        method: 'POST',
        url: `/api/study-sessions/${session.id}/complete`,
        headers: headers(crypto.randomUUID(), owner),
        payload: { version: 1, gains: '理解行锁' },
      })
    ).json()
    return { topic, session, completed }
  }

  it('returns the log for a completed session and hides other users', async () => {
    const { session, completed } = await completeSession()
    const found = await app.inject({
      method: 'GET',
      url: `/api/study-sessions/${session.id}/learning-log`,
      headers: { 'x-user-id': user },
    })
    expect(found.statusCode).toBe(200)
    expect(found.json()).toMatchObject({
      id: completed.learningLog.id,
      sessionId: session.id,
      gains: '理解行锁',
    })

    const foreign = await app.inject({
      method: 'GET',
      url: `/api/study-sessions/${session.id}/learning-log`,
      headers: { 'x-user-id': other },
    })
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().error.code).toBe('LEARNING_LOG_NOT_FOUND')
  })

  it('patches summary fields, no-ops unchanged text, and rejects stale versions', async () => {
    const { completed } = await completeSession()
    const logId = completed.learningLog.id

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/learning-logs/${logId}`,
      headers: { 'x-user-id': user },
      payload: { version: 1, nextStep: '继续练习隔离级别' },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json()).toMatchObject({
      id: logId,
      gains: '理解行锁',
      nextStep: '继续练习隔离级别',
      version: 2,
    })

    const noop = await app.inject({
      method: 'PATCH',
      url: `/api/learning-logs/${logId}`,
      headers: { 'x-user-id': user },
      payload: { version: 2, nextStep: '继续练习隔离级别' },
    })
    expect(noop.statusCode).toBe(200)
    expect(noop.json().version).toBe(2)

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/learning-logs/${logId}`,
      headers: { 'x-user-id': user },
      payload: { version: 1, problems: '还不熟' },
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json().error.code).toBe('LEARNING_LOG_VERSION_CONFLICT')
    expect(stale.json().error.details.learningLog.version).toBe(2)

    const foreign = await app.inject({
      method: 'PATCH',
      url: `/api/learning-logs/${logId}`,
      headers: { 'x-user-id': other },
      payload: { version: 2, gains: '别人的总结' },
    })
    expect(foreign.statusCode).toBe(404)
    expect(foreign.json().error.code).toBe('LEARNING_LOG_NOT_FOUND')
  })

  it('rejects a patch with only version', async () => {
    const { completed } = await completeSession()
    const rejected = await app.inject({
      method: 'PATCH',
      url: `/api/learning-logs/${completed.learningLog.id}`,
      headers: { 'x-user-id': user },
      payload: { version: 1 },
    })
    expect(rejected.statusCode).toBe(400)
    expect(rejected.json().error.code).toBe('VALIDATION_ERROR')
  })
})
