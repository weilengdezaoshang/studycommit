import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import Redis from 'ioredis'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { applyTestEnv, testEnv } from '../helpers/env'

describe('test infrastructure', () => {
  const pool = new Pool({ connectionString: testEnv.DATABASE_URL })
  const redis = new Redis(testEnv.REDIS_URL, { lazyConnect: true })
  beforeAll(async () => { applyTestEnv(); await migrate(drizzle(pool), { migrationsFolder: './drizzle' }) })
  afterAll(async () => { await pool.end(); redis.disconnect() })
  it('runs migrations repeatedly and PostgreSQL responds', async () => { await migrate(drizzle(pool), { migrationsFolder: './drizzle' }); expect((await pool.query('select 1 as value')).rows[0].value).toBe(1) })
  it('Redis responds to ping', async () => { await redis.connect(); expect(await redis.ping()).toBe('PONG') })
  it('created the topics constraints', async () => { const result = await pool.query("select constraint_name from information_schema.table_constraints where table_name='topics'"); expect(result.rows.map((row) => row.constraint_name)).toContain('topics_color_format') })
})
