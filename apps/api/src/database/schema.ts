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
export const deskZone = pgEnum('desk_zone', ['wall', 'shelf', 'desktop', 'foreground'])
export const knowledgeNodeStatus = pgEnum('knowledge_node_status', [
  'locked',
  'available',
  'learning',
  'learned',
  'reviewing',
  'mastered',
])
export const memoryStatus = pgEnum('shared_memory_status', ['active', 'deleted'])
export const paperBackground = pgEnum('paper_background', ['plain', 'dot', 'rule', 'grid'])
export const userStatus = pgEnum('user_status', ['active', 'disabled', 'merged'])
export const authProvider = pgEnum('auth_provider', ['phone', 'wechat_unionid', 'wechat_mini'])
export const authDeviceType = pgEnum('auth_device_type', ['desktop', 'mobile', 'miniprogram'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    nickname: varchar('nickname', { length: 50 }).notNull().default('学习者'),
    avatarUrl: text('avatar_url'),
    status: userStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('users_nickname_not_blank', sql`length(trim(${table.nickname})) > 0`),
    index('users_status_created_idx').on(table.status, table.createdAt, table.id),
  ],
)

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    provider: authProvider('provider').notNull(),
    providerSubject: varchar('provider_subject', { length: 128 }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_identities_provider_subject_unique').on(
      table.provider,
      table.providerSubject,
    ),
    index('auth_identities_user_idx').on(table.userId),
  ],
)

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull(),
    deviceType: authDeviceType('device_type').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_sessions_refresh_hash_unique').on(table.refreshTokenHash),
    index('auth_sessions_user_idx').on(table.userId, table.createdAt),
  ],
)

export const templates = pgTable(
  'templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id'),
    name: varchar('name', { length: 18 }).notNull(),
    icon: varchar('icon', { length: 100 }).notNull(),
    paperBackground: paperBackground('paper_background').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check('templates_name_not_blank', sql`length(trim(${table.name})) > 0`),
    check('templates_icon_not_blank', sql`length(trim(${table.icon})) > 0`),
    check('templates_version_positive', sql`${table.version} >= 1`),
    index('templates_user_created_idx').on(table.userId, table.createdAt, table.id),
  ],
)

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    description: varchar('description', { length: 1000 }),
    color: varchar('color', { length: 7 }).notNull(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
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
    uniqueIndex('topics_user_name_unique')
      .on(table.userId, sql`lower(trim(${table.name}))`)
      .where(sql`${table.deletedAt} is null`),
  ],
)

export const papers = pgTable(
  'papers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    content: text('content').notNull(),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check('papers_content_not_blank', sql`length(trim(${table.content})) > 0`),
    check('papers_content_length', sql`length(${table.content}) <= 20000`),
    check('papers_version_positive', sql`${table.version} >= 1`),
    index('papers_user_created_idx').on(table.userId, table.createdAt, table.id),
    index('papers_user_topic_created_idx').on(
      table.userId,
      table.topicId,
      table.createdAt,
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

export const knowledgeNodes = pgTable(
  'knowledge_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    status: knowledgeNodeStatus('status').notNull().default('available'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('knowledge_nodes_user_topic_idx').on(table.userId, table.topicId, table.id)],
)

export const userKnowledgeProgress = pgTable(
  'user_knowledge_progress',
  {
    userId: uuid('user_id').notNull(),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => knowledgeNodes.id, { onDelete: 'restrict' }),
    learningLogCount: integer('learning_log_count').notNull().default(0),
    evidenceScore: integer('evidence_score').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.nodeId] })],
)

export const userDeskItems = pgTable(
  'user_desk_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    itemKey: varchar('item_key', { length: 100 }).notNull(),
    instanceNo: integer('instance_no').notNull().default(1),
    sourceSessionId: uuid('source_session_id').references(() => studySessions.id, {
      onDelete: 'restrict',
    }),
    sourceNodeId: uuid('source_node_id').references(() => knowledgeNodes.id, {
      onDelete: 'restrict',
    }),
    seenAt: timestamp('seen_at', { withTimezone: true }),
    placementStatus: varchar('placement_status', { length: 20 }).notNull().default('collected'),
    zone: deskZone('zone'),
    x: integer('x').notNull().default(0),
    y: integer('y').notNull().default(0),
    rotation: integer('rotation').notNull().default(0),
    scale: integer('scale').notNull().default(100),
    zIndex: integer('z_index').notNull().default(0),
    flipped: integer('flipped').notNull().default(0),
    version: integer('version').notNull().default(1),
    obtainedAt: timestamp('obtained_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_desk_items_source_unique_idx').on(
      table.userId,
      table.sourceSessionId,
      table.itemKey,
    ),
    index('user_desk_items_user_idx').on(table.userId, table.updatedAt),
  ],
)

export const deskLayouts = pgTable(
  'desk_layouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 100 }).notNull().default('默认书桌'),
    isActive: integer('is_active').notNull().default(1),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('desk_layouts_user_active_unique_idx').on(table.userId, table.isActive)],
)

export const sharedMemories = pgTable(
  'shared_memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    sourceLogId: uuid('source_log_id')
      .notNull()
      .references(() => learningLogs.id, { onDelete: 'restrict' }),
    nodeId: uuid('node_id').references(() => knowledgeNodes.id, { onDelete: 'restrict' }),
    originalText: text('original_text').notNull(),
    summary: varchar('summary', { length: 2_000 }).notNull(),
    recallAt: timestamp('recall_at', { withTimezone: true }).notNull(),
    status: memoryStatus('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('shared_memories_user_source_unique_idx').on(table.userId, table.sourceLogId),
    index('shared_memories_user_recall_idx').on(table.userId, table.status, table.recallAt),
  ],
)
