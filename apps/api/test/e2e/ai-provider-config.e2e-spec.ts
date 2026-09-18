import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('平台服务商配置', () => {
  let app: NestFastifyApplication
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL, max: 8 })
  const redis = new Redis(testEnv.REDIS_URL)
  const adminAccount = `provider_admin_${randomUUID().slice(0, 8)}`
  const viewerAccount = `provider_viewer_${randomUUID().slice(0, 8)}`

  const registerAndLogin = async (account: string) => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/account/register',
      payload: { account, password: 'secret123' },
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/account/login',
      payload: { account, password: 'secret123', deviceType: 'desktop' },
    })
    return login.json().tokens.accessToken as string
  }

  beforeAll(async () => {
    applyTestEnv()
    process.env.AI_PROVIDER_TRUSTED_BASE_URLS = 'http://127.0.0.1:9'
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    await pool.query(`update campaigns set status = 'ended' where type = 'registration_bonus'`)
    const module = await import('../../src/app.factory.js')
    app = await module.createApp()
    await registerAndLogin(adminAccount)
    const admin = await pool.query(
      `select u.id from users u join auth_identities i on i.user_id = u.id where i.provider_subject = $1`,
      [adminAccount],
    )
    await pool.query(
      `insert into admin_roles (user_id, role, reason) values ($1, 'super_admin', 'e2e 服务商管理员')
       on conflict (user_id) do nothing`,
      [admin.rows[0].id],
    )
    await registerAndLogin(viewerAccount)
    const viewer = await pool.query(
      `select u.id from users u join auth_identities i on i.user_id = u.id where i.provider_subject = $1`,
      [viewerAccount],
    )
    await pool.query(
      `insert into admin_roles (user_id, role, reason) values ($1, 'viewer', 'e2e 只读')
       on conflict (user_id) do nothing`,
      [viewer.rows[0].id],
    )
  })

  afterAll(async () => {
    await app.close()
    await pool.end()
    redis.disconnect()
  })

  const adminToken = () => registerAndLogin(adminAccount)
  const viewerToken = () => registerAndLogin(viewerAccount)

  it('只读管理员不能查看或修改服务商配置', async () => {
    const token = await viewerToken()
    const read = await app.inject({
      method: 'GET',
      url: '/api/admin/ai/provider',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(read.statusCode).toBe(403)
    const write = await app.inject({
      method: 'PUT',
      url: '/api/admin/ai/provider',
      payload: {
        expectedVersion: 1,
        protocol: 'openai',
        model: 'gpt-test',
        apiKey: 'sk-not-real',
        reason: '越权写入',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(write.statusCode).toBe(403)
  })

  it('超级管理员可保存配置,接口不回显密钥,数据库不以明文存储', async () => {
    const token = await adminToken()
    const current = await app.inject({
      method: 'GET',
      url: '/api/admin/ai/provider',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(current.statusCode).toBe(200)
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/admin/ai/provider',
      payload: {
        expectedVersion: current.json().version,
        protocol: 'openai',
        baseUrl: 'http://127.0.0.1:9/v1',
        model: 'gpt-test',
        apiKey: 'sk-e2e-not-real-key',
        reason: 'e2e 首次配置平台服务商',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(saved.statusCode).toBe(200)
    const body = saved.json()
    expect(body.hasApiKey).toBe(true)
    expect(body.apiKeyHint).toBe('••••-key')
    expect(JSON.stringify(body)).not.toContain('sk-e2e-not-real-key')
    expect(body.displayStatus).toBe('configured_unverified')

    const stored = await pool.query(
      `select api_key_ciphertext, api_key_hint, version from ai_provider_config where id = 1`,
    )
    expect(stored.rows[0].api_key_ciphertext).not.toContain('sk-e2e-not-real-key')
    expect(stored.rows[0].api_key_hint).toBe('••••-key')

    const keep = await app.inject({
      method: 'PUT',
      url: '/api/admin/ai/provider',
      payload: {
        expectedVersion: body.version,
        protocol: 'openai',
        baseUrl: 'http://127.0.0.1:9/v1',
        model: 'gpt-test-2',
        reason: 'e2e 留空保留原密钥',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(keep.statusCode).toBe(200)
    expect(keep.json().model).toBe('gpt-test-2')
    expect(keep.json().apiKeyHint).toBe('••••-key')

    const conflict = await app.inject({
      method: 'PUT',
      url: '/api/admin/ai/provider',
      payload: {
        expectedVersion: body.version,
        protocol: 'openai',
        baseUrl: 'http://127.0.0.1:9/v1',
        model: 'stale',
        reason: 'e2e 冲突写入',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(conflict.statusCode).toBe(409)

    const logs = await pool.query(
      `select action, before_snapshot, after_snapshot from admin_audit_logs
       where target_type = 'ai_provider_config' order by created_at desc limit 5`,
    )
    expect(JSON.stringify(logs.rows)).not.toContain('sk-e2e-not-real-key')
    expect(JSON.stringify(logs.rows)).not.toContain(stored.rows[0].api_key_ciphertext)
  })

  it('拒绝不安全地址,停用后新请求在预扣前失败且不回退环境变量', async () => {
    const token = await adminToken()
    const current = await app.inject({
      method: 'GET',
      url: '/api/admin/ai/provider',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(current.statusCode).toBe(200)
    const unsafe = await app.inject({
      method: 'POST',
      url: '/api/admin/ai/provider/test',
      payload: {
        protocol: 'openai',
        baseUrl: 'http://169.254.169.254/latest',
        model: 'gpt-test',
        apiKey: 'sk-not-real',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(unsafe.statusCode).toBe(200)
    expect(unsafe.json().code).toBe('unsafe_url')
    expect(JSON.stringify(unsafe.json())).not.toContain('sk-not-real')

    process.env.AI_API_KEY = 'sk-env-should-not-be-used'
    process.env.AI_MODEL = 'env-model'
    const disabled = await app.inject({
      method: 'POST',
      url: '/api/admin/ai/provider/disable',
      payload: { expectedVersion: current.json().version, reason: 'e2e 停用服务商' },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(disabled.statusCode).toBe(200)
    expect(disabled.json().displayStatus).toBe('disabled')
    expect(disabled.json().envFallbackActive).toBe(false)

    const price = await app.inject({
      method: 'POST',
      url: '/api/admin/ai/prices',
      payload: {
        action: 'paper_explain',
        priceCredits: 5,
        configSnapshot: {
          model: 'gpt-test',
          maxInputTokens: 20000,
          maxOutputTokens: 4000,
          estimatedCostPerRun: '0.0100',
          currency: 'CNY',
        },
        reason: 'e2e 定价',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(price.statusCode).toBe(200)
    const cfg = await app.inject({
      method: 'GET',
      url: '/api/admin/ai/config',
      headers: { authorization: `Bearer ${token}` },
    })
    const enabled = await app.inject({
      method: 'PUT',
      url: '/api/admin/ai/config',
      payload: {
        expectedVersion: cfg.json().version,
        aiEnabled: true,
        featureFlags: { paper_explain: true },
        dailyCostBudget: '10.0000',
        reason: 'e2e 开启计费',
      },
      headers: { authorization: `Bearer ${token}` },
    })
    expect(enabled.statusCode).toBe(200)

    const userAccount = `provider_user_${randomUUID().slice(0, 8)}`
    const userToken = await registerAndLogin(userAccount)
    const start = await app.inject({
      method: 'POST',
      url: '/api/ai/runs',
      payload: {
        action: 'paper_explain',
        expectedPrice: { priceCredits: 5, priceVersion: price.json().version },
        input: { content: '测试内容足够长', directive: 'initial', round: 1 },
      },
      headers: { authorization: `Bearer ${userToken}`, 'idempotency-key': randomUUID() },
    })
    expect(start.statusCode).toBe(503)
    expect(start.json().code).toBe('AI_PROVIDER_UNAVAILABLE')
    const reserved = await pool.query(
      `select count(*)::int as n from credit_reservations r
       join users u on u.id = r.user_id
       join auth_identities i on i.user_id = u.id
       where i.provider_subject = $1 and r.status = 'active'`,
      [userAccount],
    )
    expect(reserved.rows[0].n).toBe(0)
    delete process.env.AI_API_KEY
    delete process.env.AI_MODEL
  })
})
