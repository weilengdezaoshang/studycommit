import { check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const topicStatus = pgEnum('topic_status', ['active', 'archived'])
export const topics = pgTable('topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 80 }).notNull(),
  description: varchar('description', { length: 1000 }),
  color: varchar('color', { length: 7 }).notNull(),
  status: topicStatus('status').notNull().default('active'),
  totalDurationSeconds: integer('total_duration_seconds').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
}, (table) => [
  check('topics_name_not_blank', sql`length(trim(${table.name})) > 0`),
  check('topics_color_format', sql`${table.color} ~ '^#[0-9A-F]{6}$'`),
  check('topics_duration_nonnegative', sql`${table.totalDurationSeconds} >= 0`),
  check('topics_version_positive', sql`${table.version} >= 1`),
  index('topics_user_status_updated_idx').on(table.userId, table.status, table.updatedAt, table.id)
])

export const idempotencyRecords = pgTable('idempotency_records', {
  userId: uuid('user_id').notNull(),
  key: varchar('key', { length: 200 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: uuid('resource_id').notNull(),
  response: jsonb('response').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.userId, table.key] })])
