import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { validateEnv } from '../config/env'

async function main() {
  const env = validateEnv(process.env)
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  } finally {
    await pool.end()
  }
}
void main()
