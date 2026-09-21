import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'
import { canonicalPaperPair } from '../../src/papers/paper-knowledge.service'

describe('PaperKnowledge', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const userA = '11111111-1111-4111-8111-111111111111'
  const userB = '22222222-2222-4222-8222-222222222222'
  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    app = await (await import('../../src/app.factory.js')).createApp()
  })
  beforeEach(async () => {
    await pool.query('INSERT INTO users(id) VALUES($1),($2) ON CONFLICT DO NOTHING', [userA, userB])
    await pool.query(
      'truncate papers, learning_logs, study_sessions, idempotency_records, topics restart identity cascade',
    )
  })
  afterAll(async () => {
    await app.close()
    await pool.end()
  })
  const create = async (user = userA) =>
    (
      await app.inject({
        method: 'POST',
        url: '/api/papers',
        headers: { 'x-user-id': user, 'idempotency-key': crypto.randomUUID() },
        payload: { content: '保留原始记录' },
      })
    ).json()
  const command = (id: string, payload: object, user = userA) =>
    app.inject({
      method: 'POST',
      url: `/api/papers/${id}/knowledge`,
      headers: { 'x-user-id': user },
      payload,
    })
  const read = (id: string, user = userA) =>
    app.inject({
      method: 'GET',
      url: `/api/papers/${id}/knowledge`,
      headers: { 'x-user-id': user },
    })
  it('理解与应用独立追加且相同标识重试不覆盖原文或产生重复', async () => {
    const paper = await create()
    const payload = {
      kind: 'append',
      additionId: crypto.randomUUID(),
      type: 'understanding',
      content: '新的理解',
    }
    expect((await command(paper.id, payload)).statusCode).toBe(200)
    expect((await command(paper.id, payload)).json().additions).toHaveLength(1)
    expect((await command(paper.id, { ...payload, content: '不同内容' })).statusCode).toBe(409)
    const next = await command(paper.id, {
      ...payload,
      additionId: crypto.randomUUID(),
      type: 'application',
      content: '实际用在项目里',
    })
    expect(next.json().additions).toHaveLength(2)
    const found = await app.inject({
      method: 'GET',
      url: '/api/search?q=' + encodeURIComponent('实际用在项目里'),
      headers: { 'x-user-id': userA },
    })
    expect(found.statusCode).toBe(200)
    expect(found.json().papers.items.map((item: { id: string }) => item.id)).toContain(paper.id)

    const original = await app.inject({
      method: 'GET',
      url: `/api/papers/${paper.id}`,
      headers: { 'x-user-id': userA },
    })
    expect(original.json().content).toBe('保留原始记录')
  })
  it('大小写不同的 UUID 仍能建立关系', async () => {
    const a = await create()
    const b = await create()
    const linked = await command(a.id, {
      kind: 'link',
      targetId: String(b.id).toUpperCase(),
      relationId: crypto.randomUUID(),
      reason: '大小写归一',
    })
    expect(linked.statusCode).toBe(200)
    expect(linked.json().relations[0].targetId).toBe(b.id)
  })
  it('补充超过上限后拒绝新追加，读取只返回最近窗口', async () => {
    const paper = await create()
    for (let i = 0; i < 101; i += 1) {
      await pool.query(
        'INSERT INTO paper_additions(id,user_id,paper_id,kind,content) VALUES($1,$2,$3,$4,$5)',
        [crypto.randomUUID(), userA, paper.id, 'understanding', `补充 ${i}`],
      )
    }
    const shown = await read(paper.id)
    expect(shown.json().additions).toHaveLength(100)
    expect(shown.json().additionsHasMore).toBe(true)
    expect(
      (
        await command(paper.id, {
          kind: 'append',
          additionId: crypto.randomUUID(),
          type: 'understanding',
          content: '超出上限',
        })
      ).statusCode,
    ).toBe(409)
  })
  it('双向关系唯一且删除后能够按版本撤销', async () => {
    const a = await create(),
      b = await create()
    const relationId = crypto.randomUUID()
    const linked = await command(a.id, {
      kind: 'link',
      targetId: b.id,
      relationId,
      reason: '互相补充',
    })
    expect(linked.statusCode).toBe(200)
    expect((await read(b.id)).json().relations[0]).toMatchObject({
      targetId: a.id,
      reason: '互相补充',
    })
    expect(
      (
        await command(b.id, {
          kind: 'link',
          targetId: a.id,
          relationId: crypto.randomUUID(),
          reason: '',
        })
      ).statusCode,
    ).toBe(409)
    expect(
      (await command(a.id, { kind: 'unlink', relationId, version: 1 })).json().relations,
    ).toHaveLength(0)
    expect((await command(a.id, { kind: 'restoreLink', relationId, version: 1 })).statusCode).toBe(
      409,
    )
    expect(
      (await command(a.id, { kind: 'restoreLink', relationId, version: 2 })).json().relations,
    ).toHaveLength(1)
  })
  async function fillRelations(anchorId: string, count: number) {
    for (let i = 0; i < count; i += 1) {
      const otherId = crypto.randomUUID()
      await pool.query('INSERT INTO papers(id, user_id, content) VALUES($1,$2,$3)', [
        otherId,
        userA,
        `关联上限 ${i}`,
      ])
      const [left, right] = canonicalPaperPair(anchorId, otherId)
      await pool.query(
        'INSERT INTO paper_relations(id, user_id, paper_a, paper_b, reason) VALUES($1,$2,$3,$4,$5)',
        [crypto.randomUUID(), userA, left, right, ''],
      )
    }
  }
  it('恢复已删除关系时仍受上限约束', async () => {
    const a = await create()
    const b = await create()
    const relationId = crypto.randomUUID()
    expect(
      (await command(a.id, { kind: 'link', targetId: b.id, relationId, reason: '' })).statusCode,
    ).toBe(200)
    expect((await command(a.id, { kind: 'unlink', relationId, version: 1 })).statusCode).toBe(200)
    await fillRelations(a.id, 100)
    expect((await command(a.id, { kind: 'restoreLink', relationId, version: 2 })).statusCode).toBe(
      409,
    )
    expect(
      (await command(a.id, { kind: 'link', targetId: b.id, relationId, reason: '' })).statusCode,
    ).toBe(409)
  })
  it('对端已达上限时拒绝新建关联', async () => {
    const a = await create()
    const b = await create()
    await fillRelations(b.id, 100)
    expect(
      (
        await command(a.id, {
          kind: 'link',
          targetId: b.id,
          relationId: crypto.randomUUID(),
          reason: '',
        })
      ).statusCode,
    ).toBe(409)
  })
  it('拒绝访问其他用户的历史和跨用户关联以及自身关联', async () => {
    const a = await create(),
      b = await create(userB)
    expect((await read(a.id, userB)).statusCode).toBe(404)
    expect(
      (
        await command(a.id, {
          kind: 'link',
          targetId: b.id,
          relationId: crypto.randomUUID(),
          reason: '',
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (
        await command(a.id, {
          kind: 'link',
          targetId: a.id,
          relationId: crypto.randomUUID(),
          reason: '',
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await command(
          a.id,
          {
            kind: 'append',
            additionId: crypto.randomUUID(),
            type: 'understanding',
            content: '越权',
          },
          userB,
        )
      ).statusCode,
    ).toBe(404)
  })
})
