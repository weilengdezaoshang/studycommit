import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const topicStatus = pgEnum('topic_status', ['active', 'archived'])
export const studySessionStatus = pgEnum('study_session_status', ['running', 'paused', 'completed'])
export const topics = pgTable(
  'topics',
  {
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
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check('topics_name_not_blank', sql`length(trim(${table.name})) > 0`),
    check('topics_color_format', sql`${table.color} ~ '^#[0-9A-F]{6}$'`),
    check('topics_duration_nonnegative', sql`${table.totalDurationSeconds} >= 0`),
    check('topics_version_positive', sql`${table.version} >= 1`),
    index('topics_user_status_updated_idx').on(
      table.userId,
      table.status,
      table.updatedAt,
      table.id,
    ),
  ],
)

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    userId: uuid('user_id').notNull(),
    key: varchar('key', { length: 200 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: uuid('resource_id').notNull(),
    response: jsonb('response').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
)

export const studySessions = pgTable(
  'study_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'restrict' }),
    goal: varchar('goal', { length: 500 }),
    status: studySessionStatus('status').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    totalPausedSeconds: integer('total_paused_seconds').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    completionSource: varchar('completion_source', { length: 20 }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('study_sessions_version_positive', sql`${table.version} >= 1`),
    check('study_sessions_total_paused_nonnegative', sql`${table.totalPausedSeconds} >= 0`),
    check(
      'study_sessions_duration_nonnegative',
      sql`${table.durationSeconds} IS NULL OR ${table.durationSeconds} >= 0`,
    ),
    check(
      'study_sessions_paused_after_start',
      sql`${table.pausedAt} IS NULL OR ${table.pausedAt} >= ${table.startedAt}`,
    ),
    check(
      'study_sessions_completed_after_start',
      sql`${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`,
    ),
    check(
      'study_sessions_state_fields',
      sql`
    (${table.status} = 'running' AND ${table.pausedAt} IS NULL AND ${table.completedAt} IS NULL AND ${table.durationSeconds} IS NULL AND ${table.completionSource} IS NULL)
    OR (${table.status} = 'paused' AND ${table.pausedAt} IS NOT NULL AND ${table.completedAt} IS NULL AND ${table.durationSeconds} IS NULL AND ${table.completionSource} IS NULL)
    OR (${table.status} = 'completed' AND ${table.pausedAt} IS NULL AND ${table.completedAt} IS NOT NULL AND ${table.durationSeconds} IS NOT NULL AND ${table.completionSource} IN ('online', 'offline_sync'))
  `,
    ),
    uniqueIndex('study_sessions_one_active_per_user_idx')
      .on(table.userId)
      .where(sql`${table.status} IN ('running', 'paused')`),
    index('study_sessions_user_started_idx').on(table.userId, table.startedAt, table.id),
    index('study_sessions_topic_completed_idx')
      .on(table.userId, table.topicId, table.completedAt)
      .where(sql`${table.status} = 'completed'`),
  ],
)

export const learningLogs = pgTable(
  'learning_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => studySessions.id, { onDelete: 'restrict' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'restrict' }),
    gains: text('gains'),
    problems: text('problems'),
    nextStep: text('next_step'),
    effectiveDurationSeconds: integer('effective_duration_seconds').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('learning_logs_duration_nonnegative', sql`${table.effectiveDurationSeconds} >= 0`),
    check('learning_logs_version_positive', sql`${table.version} >= 1`),
    check(
      'learning_logs_gains_length',
      sql`${table.gains} IS NULL OR length(${table.gains}) <= 10000`,
    ),
    check(
      'learning_logs_problems_length',
      sql`${table.problems} IS NULL OR length(${table.problems}) <= 10000`,
    ),
    check(
      'learning_logs_next_step_length',
      sql`${table.nextStep} IS NULL OR length(${table.nextStep}) <= 5000`,
    ),
    uniqueIndex('learning_logs_session_unique_idx').on(table.sessionId),
    index('learning_logs_user_created_idx').on(table.userId, table.createdAt, table.id),
    index('learning_logs_user_topic_created_idx').on(
      table.userId,
      table.topicId,
      table.createdAt,
      table.id,
    ),
  ],
)
