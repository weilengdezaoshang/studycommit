import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: Pool
  readonly db: NodePgDatabase<typeof schema>
  constructor(@Inject(ConfigService) config: ConfigService) {
    this.pool = new Pool({ connectionString: config.getOrThrow<string>('DATABASE_URL'), max: 10, connectionTimeoutMillis: 2000 })
    this.db = drizzle(this.pool, { schema })
  }
  async ping() { await this.pool.query('SELECT 1') }
  async onModuleDestroy() { await this.pool.end() }
}
