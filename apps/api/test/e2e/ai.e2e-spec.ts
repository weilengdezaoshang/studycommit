import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('AI API', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const redis = new Redis(testEnv.REDIS_URL)

  beforeAll(async () => {
    applyTestEnv()
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    redis.disconnect()
  })

  const followup = (body: object, token?: string) =>
    app.inject({
      method: 'POST',
      url: '/api/ai/papers/explain',
      payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })

  const registerAndLogin = async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/account/register',
      payload: { account: 'ai_user', password: 'secret123' },
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/account/login',
      payload: { account: 'ai_user', password: 'secret123', deviceType: 'desktop' },
    })
    return login.json().tokens.accessToken as string
  }

  it('未登录访问陪学追问被拒绝', async () => {
    const response = await followup({ content: '讲解内容' })
    expect(response.statusCode).toBe(401)
  })

  it('输入过短讲解被拒绝', async () => {
    const token = await registerAndLogin()
    const response = await followup({ content: '   ' }, token)
    expect(response.statusCode).toBe(400)
  })

  it('未配置 AI 供应商时返回固定降级错误码', async () => {
    const token = await registerAndLogin()
    const response = await followup({ content: 'React 的批处理会合并多次更新。' }, token)
    expect(response.statusCode).toBe(503)
    expect(response.json().code).toBe('AI_UNAVAILABLE')
  })

  const confirm = (runId: string, token: string) =>
    app.inject({
      method: 'POST',
      url: `/api/ai/runs/${runId}/confirm`,
      payload: {},
      headers: { authorization: `Bearer ${token}` },
    })

  const insertExplainRun = async (userId: string, paperId: string) => {
    const runId = crypto.randomUUID()
    await pool.query(
      `insert into agent_runs (id, user_id, kind, status, prompt_version, input)
       values ($1, $2, 'paper_explain', 'completed', 'test-v1', $3::jsonb)`,
      [runId, userId, JSON.stringify({ paperId, content: '事件循环', round: 1 })],
    )
    return runId
  }

  const currentUserId = async () => {
    const { rows } = await pool.query(
      `select u.id from users u join auth_identities a on a.user_id = u.id
       where a.provider_subject = 'ai_user' limit 1`,
    )
    return rows[0].id as string
  }

  it('确认解释卡后把还在思考的纸页落定为已解决并双写布尔字段', async () => {
    const token = await registerAndLogin()
    const userId = await currentUserId()

    // 还在思考的纸页:确认后应落定为已解决
    const thinkingId = crypto.randomUUID()
    await pool.query(
      `insert into papers (id, user_id, content, has_question, question_status, question_text)
       values ($1, $2, '事件循环是什么', true, 'thinking', '事件循环是什么')`,
      [thinkingId, userId],
    )
    // 没有问题的纸页:确认后应保持原状
    const plainId = crypto.randomUUID()
    await pool.query(
      `insert into papers (id, user_id, content, has_question, question_status)
       values ($1, $2, '没有问题的记录', false, 'none')`,
      [plainId, userId],
    )

    const thinkingRun = await insertExplainRun(userId, thinkingId)
    const confirmed = await confirm(thinkingRun, token)
    expect(confirmed.statusCode).toBe(200)
    expect(confirmed.json()).toEqual({ confirmed: true })

    const { rows } = await pool.query(
      'select question_status, question_resolved_at, has_question, is_question_resolved, version from papers where id = $1',
      [thinkingId],
    )
    expect(rows[0]).toMatchObject({
      question_status: 'resolved',
      has_question: true,
      is_question_resolved: true,
      version: 2,
    })
    expect(rows[0].question_resolved_at).not.toBeNull()

    // 重复确认幂等:不再递增纸页版本
    expect((await confirm(thinkingRun, token)).json()).toEqual({ confirmed: true })
    const replayed = await pool.query('select version from papers where id = $1', [thinkingId])
    expect(replayed.rows[0].version).toBe(2)

    // 无问题纸页只确认运行记录,不改变问题状态
    const plainRun = await insertExplainRun(userId, plainId)
    expect((await confirm(plainRun, token)).json()).toEqual({ confirmed: true })
    const plain = await pool.query(
      'select question_status, is_question_resolved, version from papers where id = $1',
      [plainId],
    )
    expect(plain.rows[0]).toMatchObject({
      question_status: 'none',
      is_question_resolved: false,
      version: 1,
    })
  })

  it('确认解释卡不触碰已删除纸页的问题状态', async () => {
    const token = await registerAndLogin()
    const userId = await currentUserId()
    const paperId = crypto.randomUUID()
    await pool.query(
      `insert into papers (id, user_id, content, has_question, question_status, question_text, deleted_at)
       values ($1, $2, '已删除还在思考', true, 'thinking', '已删除还在思考', now())`,
      [paperId, userId],
    )
    const runId = await insertExplainRun(userId, paperId)

    expect((await confirm(runId, token)).json()).toEqual({ confirmed: true })

    const { rows } = await pool.query('select version from papers where id = $1', [paperId])
    expect(rows[0].version).toBe(1)
  })
})
