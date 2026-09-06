import { desc, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  boolean,
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
export const paperQuestionStatus = pgEnum('paper_question_status', ['none', 'thinking', 'resolved'])
export const userStatus = pgEnum('user_status', ['active', 'disabled', 'merged'])
export const agentRunKind = pgEnum('agent_run_kind', ['companion_followup', 'paper_explain'])
export const agentRunStatus = pgEnum('agent_run_status', ['pending', 'completed', 'failed'])
export const authProvider = pgEnum('auth_provider', [
  'phone',
  'wechat_unionid',
  'wechat_mini',
  'account',
])
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
    passwordHash: text('password_hash'),
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
    hasQuestion: boolean('has_question').notNull().default(false),
    isQuestionResolved: boolean('is_question_resolved').notNull().default(false),
    /** 问题三态;与 has_question/is_question_resolved 双写,契约切换完成前布尔列保留。 */
    questionStatus: paperQuestionStatus('question_status').notNull().default('none'),
    /** 用户确认的问题文本;none 时必为空。 */
    questionText: text('question_text'),
    /** 用户对问题的理解文本。 */
    understandingText: text('understanding_text'),
    /** 标记解决的服务端时间;resolved 必非空,thinking 必为空。 */
    questionResolvedAt: timestamp('question_resolved_at', { withTimezone: true }),
    /** 纸页来源:移动端直记 / 桌面截图 / 桌面收尾创建。 */
    source: varchar('source', { length: 20 }).notNull().default('mobile_direct'),
    /** 来源学习会话;桌面收尾创建的“下一个问题”回链会话。 */
    sourceSessionId: uuid('source_session_id'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check('papers_content_not_blank', sql`length(trim(${table.content})) > 0`),
    check('papers_content_length', sql`length(${table.content}) <= 20000`),
    check('papers_version_positive', sql`${table.version} >= 1`),
    check(
      'papers_question_state',
      sql`
    (${table.questionStatus} = 'resolved' AND ${table.questionResolvedAt} IS NOT NULL AND ${table.questionText} IS NOT NULL AND length(trim(${table.questionText})) > 0 AND length(${table.questionText}) <= 2000)
    OR (${table.questionStatus} = 'thinking' AND ${table.questionResolvedAt} IS NULL AND ${table.questionText} IS NOT NULL AND length(trim(${table.questionText})) > 0 AND length(${table.questionText}) <= 2000)
    OR (${table.questionStatus} = 'none' AND ${table.questionResolvedAt} IS NULL AND ${table.questionText} IS NULL)
  `,
    ),
    check(
      'papers_understanding_text_length',
      sql`${table.understandingText} IS NULL OR length(${table.understandingText}) <= 20000`,
    ),
    check(
      'papers_source_domain',
      sql`${table.source} IN ('mobile_direct', 'desktop_capture', 'desktop_session')`,
    ),
    index('papers_user_created_idx').on(table.userId, table.createdAt, table.id),
    index('papers_user_topic_created_idx').on(
      table.userId,
      table.topicId,
      table.createdAt,
      table.id,
    ),
    index('papers_user_thinking_created_idx')
      .on(table.userId, desc(table.createdAt), desc(table.id))
      .where(sql`${table.questionStatus} = 'thinking' AND ${table.deletedAt} IS NULL`),
  ],
)

/**
 * Agent 运行记录:所有 AI 输出必须落库并携带模型、Prompt 版本与确认状态
 * (PRD 红线:AI 只产生候选,用户确认后才写入业务数据)。
 */
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    kind: agentRunKind('kind').notNull(),
    status: agentRunStatus('status').notNull().default('pending'),
    model: text('model'),
    promptVersion: text('prompt_version').notNull(),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    error: text('error'),
    /** 候选内容被用户确认的时间;null 表示尚未确认或已放弃 */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('agent_runs_user_kind_created_idx').on(table.userId, table.kind, table.createdAt),
  ],
)

export const paperAssetKind = pgEnum('paper_asset_kind', ['image', 'source_screenshot'])
export const paperAssetStatus = pgEnum('paper_asset_status', [
  'pending',
  'uploaded',
  'attached',
  'deleted',
])

/**
 * 图片资产:三步直传会话与私有对象存储引用(BE-308)。
 * status=pending 的会话过期后由清理任务删除对象并软删行;
 * attached 必须有 paper_id,其余状态必须没有(paper_assets_state CHECK)。
 */
export const paperAssets = pgTable(
  'paper_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    paperId: uuid('paper_id'),
    uploadId: uuid('upload_id').notNull(),
    kind: paperAssetKind('kind').notNull(),
    status: paperAssetStatus('status').notNull().default('pending'),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    sha256: text('sha256').notNull(),
    ocrText: text('ocr_text'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('paper_assets_user_upload_id_idx').on(table.userId, table.uploadId),
    index('paper_assets_paper_id_idx').on(table.paperId),
    index('paper_assets_pending_expiry_idx')
      .on(table.userId, table.status, table.expiresAt)
      .where(sql`status = 'pending'`),
  ],
)

/**
 * 学习过程片段(M-3 / BE-309):会话期间"记下一点"的连续写入。
 * id 由客户端生成,兼作幂等锚点;列表按 (paper_id, position) 排序。
 */
export const paperFragments = pgTable(
  'paper_fragments',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    paperId: uuid('paper_id')
      .notNull()
      .references(() => papers.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => studySessions.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    position: integer('position').notNull().default(0),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'paper_fragments_state',
      sql`
    ${table.version} >= 1
    AND ${table.position} >= 0
    AND length(trim(${table.content})) > 0
    AND length(${table.content}) <= 2000
  `,
    ),
    index('paper_fragments_paper_position_idx').on(table.paperId, table.position, table.id),
    index('paper_fragments_session_position_idx').on(table.sessionId, table.position, table.id),
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
    /** 主题路径可选;桌面截图链路从纸页问题起步。 */
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'restrict' }),
    /** 关联纸页:source 为桌面来源时必填。 */
    paperId: uuid('paper_id'),
    /** 会话来源:主题手动 / 截图新问题 / 既有问题继续。 */
    source: varchar('source', { length: 30 }).notNull().default('manual_topic'),
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
    check(
      'study_sessions_paper_source',
      sql`
    (${table.source} IN ('desktop_capture', 'desktop_existing_question') AND ${table.paperId} IS NOT NULL AND ${table.topicId} IS NULL)
    OR ${table.source} = 'manual_topic'
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
