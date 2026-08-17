import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('Topics API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const userA = '11111111-1111-4111-8111-111111111111'
  const userB = '22222222-2222-4222-8222-222222222222'
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
  const create = (
    user = userA,
    key = crypto.randomUUID(),
    body: object = { name: ' Node.js ', color: '#4f46e5' },
  ) =>
    app.inject({
      method: 'POST',
      url: '/api/topics',
      headers: { 'x-user-id': user, 'idempotency-key': key },
      payload: body,
    })

  it('creates, lists, updates and soft deletes a topic', async () => {
    const created = await create()
    expect(created.statusCode).toBe(201)
    const topic = created.json()
    expect(topic).toMatchObject({
      name: 'Node.js',
      color: '#4F46E5',
      status: 'active',
      version: 1,
    })
    const list = await app.inject({
      method: 'GET',
      url: '/api/topics',
      headers: { 'x-user-id': userA },
    })
    expect(list.json().items).toHaveLength(1)
    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA },
      payload: { name: 'Node 深入', version: 1 },
    })
    expect(updated.json()).toMatchObject({ name: 'Node 深入', version: 2 })
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA, 'if-match': '"2"' },
    })
    expect(removed.statusCode).toBe(204)
    const missing = await app.inject({
      method: 'GET',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA },
    })
    expect(missing.statusCode).toBe(404)
  })
  it('isolates users as not found', async () => {
    const topic = (await create()).json()
    const response = await app.inject({
      method: 'GET',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userB },
    })
    expect(response.statusCode).toBe(404)
  })
  it('replays equal requests and rejects changed content', async () => {
    const first = await create(userA, 'same-key')
    const replay = await create(userA, 'same-key')
    expect(replay.json().id).toBe(first.json().id)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    const conflict = await create(userA, 'same-key', { name: 'Different', color: '#000000' })
    expect(conflict.statusCode).toBe(409)
    expect(conflict.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })
  it('validates input, identity and optimistic versions', async () => {
    expect((await create(userA, crypto.randomUUID(), { name: '', color: 'red' })).statusCode).toBe(
      400,
    )
    expect((await app.inject({ method: 'GET', url: '/api/topics' })).statusCode).toBe(401)
    const topic = (await create()).json()
    const conflict = await app.inject({
      method: 'PATCH',
      url: `/api/topics/${topic.id}`,
      headers: { 'x-user-id': userA },
      payload: { name: 'Old', version: 9 },
    })
    expect(conflict.statusCode).toBe(409)
  })
  it('paginates without duplicates and rejects malformed cursors', async () => {
    await create(userA, 'a', { name: 'A', color: '#000000' })
    await create(userA, 'b', { name: 'B', color: '#FFFFFF' })
    const page1 = (
      await app.inject({
        method: 'GET',
        url: '/api/topics?limit=1',
        headers: { 'x-user-id': userA },
      })
    ).json()
    expect(page1.pageInfo.hasNextPage).toBe(true)
    const page2 = (
      await app.inject({
        method: 'GET',
        url: `/api/topics?limit=1&cursor=${encodeURIComponent(page1.pageInfo.nextCursor)}`,
        headers: { 'x-user-id': userA },
      })
    ).json()
    expect(page2.items[0].id).not.toBe(page1.items[0].id)
    const bad = await app.inject({
      method: 'GET',
      url: '/api/topics?cursor=broken',
      headers: { 'x-user-id': userA },
    })
    expect(bad.statusCode).toBe(400)
  })
})
