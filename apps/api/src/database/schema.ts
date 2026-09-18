import type { RichTextDocument } from '@studycommit/rpc-contracts/rich-text'
import type { CampaignDraftConfig } from '@studycommit/rpc-contracts/campaigns'
import { desc, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  boolean,
  jsonb,
  numeric,
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
    contentDocument: jsonb('content_document').$type<RichTextDocument>(),
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
    /** 计费幂等键:同一用户内唯一;null 表示历史免费运行(计费上线前的运行不含此列值) */
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    /** 受理请求摘要:同一幂等键携带不同内容时判冲突 */
    requestHash: varchar('request_hash', { length: 64 }),
    priceVersion: integer('price_version'),
    reservedCredits: integer('reserved_credits'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('agent_runs_user_kind_created_idx').on(table.userId, table.kind, table.createdAt),
    uniqueIndex('agent_runs_user_idempotency_key_unique')
      .on(table.userId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
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
    /** 附件在纸页中的稳定顺序，创建时按 assetUploadIds 写入。 */
    position: integer('position').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('paper_assets_user_upload_id_idx').on(table.userId, table.uploadId),
    index('paper_assets_paper_id_idx').on(table.paperId),
    uniqueIndex('paper_assets_paper_position_unique')
      .on(table.paperId, table.position)
      .where(sql`${table.status} = 'attached' AND ${table.deletedAt} IS NULL`),
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

/** 追加历史不覆盖原文；关系以固定 UUID 顺序保证双向唯一。 */
export const paperAdditions = pgTable(
  'paper_additions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    paperId: uuid('paper_id')
      .notNull()
      .references(() => papers.id),
    kind: text('kind').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('paper_additions_kind_check', sql`${table.kind} IN ('understanding','application')`),
    check('paper_additions_content_check', sql`length(trim(${table.content})) BETWEEN 1 AND 20000`),
    index('paper_additions_owner_paper').on(table.userId, table.paperId, table.createdAt),
  ],
)
export const paperRelations = pgTable(
  'paper_relations',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    paperA: uuid('paper_a')
      .notNull()
      .references(() => papers.id),
    paperB: uuid('paper_b')
      .notNull()
      .references(() => papers.id),
    reason: text('reason').notNull().default(''),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check('paper_relations_check', sql`${table.paperA} < ${table.paperB}`),
    check('paper_relations_reason_check', sql`length(${table.reason}) <= 2000`),
    uniqueIndex('paper_relations_user_id_paper_a_paper_b_key').on(
      table.userId,
      table.paperA,
      table.paperB,
    ),
  ],
)

// ---------------------------------------------------------------------------
// 运营活动与 Agent 积分(docs/plans/operations-credits)。
// Postgres 是账务唯一权威;积分一律非负整数,上限常量见各服务 constants。
// ---------------------------------------------------------------------------

export const campaignType = pgEnum('campaign_type', ['registration_bonus', 'limited_claim'])
export const campaignStatus = pgEnum('campaign_status', ['draft', 'published', 'paused', 'ended'])
export const campaignClaimStatus = pgEnum('campaign_claim_status', [
  'granted',
  'pending_compensation',
])
export const creditGrantSource = pgEnum('credit_grant_source', ['campaign', 'admin_grant'])
export const creditGrantStatus = pgEnum('credit_grant_status', ['active', 'expired'])
export const creditReservationStatus = pgEnum('credit_reservation_status', [
  'active',
  'settled',
  'released',
  'expired',
])
export const creditLedgerKind = pgEnum('credit_ledger_kind', [
  'grant',
  'reserve',
  'settle',
  'release',
  'expire',
])
export const outboxEventStatus = pgEnum('outbox_event_status', [
  'pending',
  'processing',
  'done',
  'failed',
])
export const adminRoleLevel = pgEnum('admin_role_level', [
  'viewer',
  'operator',
  'publisher',
  'super_admin',
])

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull(),
    type: campaignType('type').notNull(),
    status: campaignStatus('status').notNull().default('draft'),
    /** 已发布版本数;0 表示从未发布。发布新规则 = currentVersion + 1。 */
    currentVersion: integer('current_version').notNull().default(0),
    /** 草稿配置;发布时快照进 campaign_versions,发布后修改需再次发布生效。 */
    draftConfig: jsonb('draft_config').$type<CampaignDraftConfig>().notNull(),
    /** 累计发放积分(预算按发放计,不因消费/到期恢复)。 */
    totalGrantedCredits: integer('total_granted_credits').notNull().default(0),
    totalClaimCount: integer('total_claim_count').notNull().default(0),
    totalBudgetCredits: integer('total_budget_credits'),
    totalClaimLimit: integer('total_claim_limit'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('campaigns_code_unique').on(table.code),
    check('campaigns_version_nonnegative', sql`${table.currentVersion} >= 0`),
    check(
      'campaigns_budget_nonnegative',
      sql`${table.totalBudgetCredits} IS NULL OR ${table.totalBudgetCredits} >= 0`,
    ),
    check(
      'campaigns_claim_limit_nonnegative',
      sql`${table.totalClaimLimit} IS NULL OR ${table.totalClaimLimit} >= 0`,
    ),
    check('campaigns_granted_nonnegative', sql`${table.totalGrantedCredits} >= 0`),
    check('campaigns_claim_count_nonnegative', sql`${table.totalClaimCount} >= 0`),
    check(
      'campaigns_budget_respected',
      sql`${table.totalBudgetCredits} IS NULL OR ${table.totalGrantedCredits} <= ${table.totalBudgetCredits}`,
    ),
    check(
      'campaigns_claim_limit_respected',
      sql`${table.totalClaimLimit} IS NULL OR ${table.totalClaimCount} <= ${table.totalClaimLimit}`,
    ),
  ],
)

/** 发布时的不可变规则快照;禁止 UPDATE,规则变更一律发布新版本。 */
export const campaignVersions = pgTable(
  'campaign_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    /** 领取窗口与发放参数快照(热路径列,供领取事务 SQL 直接校验)。 */
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    grantCredits: integer('grant_credits').notNull(),
    creditValidityDays: integer('credit_validity_days'),
    fixedExpiresAt: timestamp('fixed_expires_at', { withTimezone: true }),
    perUserLimit: integer('per_user_limit').notNull().default(1),
    eligibilityVersion: integer('eligibility_version').notNull(),
    /** 完整规则快照(含 platforms/eligibility/copy),供审计与详情回放。 */
    configSnapshot: jsonb('config_snapshot').$type<CampaignDraftConfig>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('campaign_versions_campaign_version_unique').on(table.campaignId, table.version),
    check('campaign_versions_credits_positive', sql`${table.grantCredits} >= 1`),
    check('campaign_versions_per_user_limit_positive', sql`${table.perUserLimit} >= 1`),
    check('campaign_versions_window_ordered', sql`${table.startsAt} < ${table.endsAt}`),
    check(
      'campaign_versions_validity_exclusive',
      sql`(${table.creditValidityDays} IS NULL) <> (${table.fixedExpiresAt} IS NULL)`,
    ),
    check('campaign_versions_validity_days_positive', sql`${table.creditValidityDays} >= 1`),
    index('campaign_versions_campaign_idx').on(table.campaignId, table.version),
  ],
)

/** 领取/注册奖励记录;UNIQUE(campaign,user,slot) 是"同一活动每人一次"的权威约束。 */
export const campaignClaims = pgTable(
  'campaign_claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'restrict' }),
    /** 领取时绑定的规则版本;版本变更不重置每人领取次数。 */
    version: integer('version').notNull(),
    slot: integer('slot').notNull().default(1),
    status: campaignClaimStatus('status').notNull().default('granted'),
    grantId: uuid('grant_id'),
    /** 手动领取幂等键;注册奖励为 null。 */
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('campaign_claims_campaign_user_slot_unique').on(
      table.campaignId,
      table.userId,
      table.slot,
    ),
    uniqueIndex('campaign_claims_user_idempotency_unique')
      .on(table.userId, table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
    index('campaign_claims_user_created_idx').on(table.userId, table.createdAt),
    index('campaign_claims_campaign_idx').on(table.campaignId, table.createdAt),
  ],
)

export const creditAccounts = pgTable(
  'credit_accounts',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'restrict' }),
    available: integer('available').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    lifetimeGranted: integer('lifetime_granted').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('credit_accounts_available_nonnegative', sql`${table.available} >= 0`),
    check('credit_accounts_reserved_nonnegative', sql`${table.reserved} >= 0`),
    check('credit_accounts_lifetime_nonnegative', sql`${table.lifetimeGranted} >= 0`),
  ],
)

/** 积分批次:发放即建批次,消费按先到期先使用;过期未冻结额由清扫转 expire。 */
export const creditGrants = pgTable(
  'credit_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    source: creditGrantSource('source').notNull().default('campaign'),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    claimId: uuid('claim_id').references(() => campaignClaims.id, { onDelete: 'set null' }),
    originalAmount: integer('original_amount').notNull(),
    /** 未冻结可用余额。 */
    remainingAvailable: integer('remaining_available').notNull(),
    frozenAmount: integer('frozen_amount').notNull().default(0),
    status: creditGrantStatus('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('credit_grants_original_positive', sql`${table.originalAmount} >= 1`),
    check('credit_grants_remaining_nonnegative', sql`${table.remainingAvailable} >= 0`),
    check('credit_grants_frozen_nonnegative', sql`${table.frozenAmount} >= 0`),
    check(
      'credit_grants_amounts_within_original',
      sql`${table.remainingAvailable} + ${table.frozenAmount} <= ${table.originalAmount}`,
    ),
    check(
      'credit_grants_expired_state',
      sql`(${table.status} = 'expired') = (${table.expiredAt} IS NOT NULL)`,
    ),
    /** FEFO 消费排序:先到期在前,无到期批次最后;id 保证稳定。 */
    index('credit_grants_user_fefo_idx').on(table.userId, table.status, table.expiresAt, table.id),
    index('credit_grants_expiry_sweep_idx')
      .on(table.status, table.expiresAt)
      .where(sql`status = 'active' AND expires_at IS NOT NULL`),
  ],
)

/** 一次冻结的头部;runId 唯一保证一个运行最多一笔冻结。 */
export const creditReservations = pgTable(
  'credit_reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    runId: uuid('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'restrict' }),
    amount: integer('amount').notNull(),
    status: creditReservationStatus('status').notNull().default('active'),
    priceVersion: integer('price_version').notNull(),
    /** 对账截止时间;超过仍无结果则释放冻结并终态化运行。 */
    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('credit_reservations_run_unique').on(table.runId),
    check('credit_reservations_amount_positive', sql`${table.amount} >= 1`),
    check(
      'credit_reservations_state_fields',
      sql`
    (${table.status} = 'active' AND ${table.settledAt} IS NULL AND ${table.releasedAt} IS NULL)
    OR (${table.status} = 'settled' AND ${table.settledAt} IS NOT NULL AND ${table.releasedAt} IS NULL)
    OR ((${table.status} = 'released' OR ${table.status} = 'expired') AND ${table.settledAt} IS NULL AND ${table.releasedAt} IS NOT NULL)
  `,
    ),
    index('credit_reservations_user_status_idx').on(table.userId, table.status),
    index('credit_reservations_deadline_idx')
      .on(table.status, table.deadlineAt)
      .where(sql`status = 'active'`),
  ],
)

/** 冻结使用了哪些批次;结算/释放按此回写 grant.frozen。 */
export const creditAllocations = pgTable(
  'credit_allocations',
  {
    reservationId: uuid('reservation_id')
      .notNull()
      .references(() => creditReservations.id, { onDelete: 'restrict' }),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => creditGrants.id, { onDelete: 'restrict' }),
    amount: integer('amount').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.reservationId, table.grantId] }),
    check('credit_allocations_amount_positive', sql`${table.amount} >= 1`),
  ],
)

/** 追加式流水:余额变化的唯一可重建依据;禁止 UPDATE/DELETE。eventId 幂等防重。 */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    eventId: varchar('event_id', { length: 100 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    kind: creditLedgerKind('kind').notNull(),
    deltaAvailable: integer('delta_available').notNull(),
    deltaReserved: integer('delta_reserved').notNull(),
    /** 事务内变化后的账户快照,便于对账重建。 */
    balanceAvailableAfter: integer('balance_available_after').notNull(),
    balanceReservedAfter: integer('balance_reserved_after').notNull(),
    grantId: uuid('grant_id').references(() => creditGrants.id, { onDelete: 'set null' }),
    reservationId: uuid('reservation_id').references(() => creditReservations.id, {
      onDelete: 'set null',
    }),
    runId: uuid('run_id'),
    campaignId: uuid('campaign_id'),
    claimId: uuid('claim_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('credit_ledger_user_created_idx').on(table.userId, table.createdAt, table.eventId),
    index('credit_ledger_reservation_idx').on(table.reservationId),
    index('credit_ledger_campaign_idx').on(table.campaignId, table.createdAt),
  ],
)

/** AI 服务开关单例(id=1);缺失行按"全部关闭"处理。 */
export const aiServiceConfig = pgTable(
  'ai_service_config',
  {
    id: integer('id').primaryKey().default(1),
    aiEnabled: boolean('ai_enabled').notNull().default(false),
    /** 功能级开关,如 {"paper_explain": true};缺省键视为关闭。 */
    featureFlags: jsonb('feature_flags').$type<Record<string, boolean>>().notNull().default({}),
    costProtectionEnabled: boolean('cost_protection_enabled').notNull().default(true),
    /** 每日供应商成本预算(固定精度);null 表示未设预算=禁止开放计费。 */
    dailyCostBudget: numeric('daily_cost_budget', { precision: 14, scale: 4 }),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('ai_service_config_version_positive', sql`${table.version} >= 1`),
    check(
      'ai_service_config_budget_nonnegative',
      sql`${table.dailyCostBudget} IS NULL OR ${table.dailyCostBudget} >= 0`,
    ),
  ],
)

/** 平台服务商配置单例(id=1);缺失行表示尚未建立数据库配置,可回退环境变量。 */
export const aiProviderConfig = pgTable(
  'ai_provider_config',
  {
    id: integer('id').primaryKey().default(1),
    protocol: varchar('protocol', { length: 20 })
      .$type<'openai' | 'anthropic' | 'gemini'>()
      .notNull(),
    baseUrl: varchar('base_url', { length: 500 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    /** AES-256-GCM 密文;密钥与密文均不得进入审计或日志。 */
    apiKeyCiphertext: text('api_key_ciphertext'),
    apiKeyHint: varchar('api_key_hint', { length: 32 }),
    status: varchar('status', { length: 20 })
      .$type<'active' | 'disabled'>()
      .notNull()
      .default('active'),
    lastTestStatus: varchar('last_test_status', { length: 20 }).$type<
      'success' | 'failed' | 'unverified' | null
    >(),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestedVersion: integer('last_tested_version'),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
  },
  (table) => [
    check('ai_provider_config_version_positive', sql`${table.version} >= 1`),
    check('ai_provider_config_status_valid', sql`${table.status} IN ('active', 'disabled')`),
    check(
      'ai_provider_config_protocol_valid',
      sql`${table.protocol} IN ('openai', 'anthropic', 'gemini')`,
    ),
    check(
      'ai_provider_config_test_status_valid',
      sql`${table.lastTestStatus} IS NULL OR ${table.lastTestStatus} IN ('success', 'failed', 'unverified')`,
    ),
  ],
)

export const aiPriceVersions = pgTable(
  'ai_price_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    action: varchar('action', { length: 50 }).notNull(),
    version: integer('version').notNull(),
    priceCredits: integer('price_credits').notNull(),
    /** 保守成本估算与模型上限快照;价格未知/无输出上限时禁止开放生产计费。 */
    configSnapshot: jsonb('config_snapshot')
      .$type<{
        model: string
        maxInputTokens: number
        maxOutputTokens: number
        estimatedCostPerRun: string
        currency: string
      }>()
      .notNull(),
    isActive: boolean('is_active').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ai_price_versions_action_version_unique').on(table.action, table.version),
    check('ai_price_versions_price_nonnegative', sql`${table.priceCredits} >= 0`),
    index('ai_price_versions_active_idx')
      .on(table.action, table.isActive)
      .where(sql`is_active`),
  ],
)

/** 按日成本预算;数值为供应商真实成本(最小货币单位或固定精度),与积分账分离。 */
export const aiCostBudgets = pgTable(
  'ai_cost_budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** UTC 日起点;UNIQUE 保证每日一行。 */
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    budget: numeric('budget', { precision: 14, scale: 4 }).notNull(),
    reservedCost: numeric('reserved_cost', { precision: 14, scale: 4 }).notNull().default('0'),
    confirmedCost: numeric('confirmed_cost', { precision: 14, scale: 4 }).notNull().default('0'),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ai_cost_budgets_period_unique').on(table.periodStart),
    check('ai_cost_budgets_budget_nonnegative', sql`${table.budget} >= 0`),
    check('ai_cost_budgets_reserved_nonnegative', sql`${table.reservedCost} >= 0`),
    check('ai_cost_budgets_confirmed_nonnegative', sql`${table.confirmedCost} >= 0`),
    check('ai_cost_budgets_period_ordered', sql`${table.periodStart} < ${table.periodEnd}`),
  ],
)

/** 事务事件投递:业务事务内写入,投递器异步消费;仅保存业务 ID,不含密钥与正文。 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    eventId: varchar('event_id', { length: 100 }).primaryKey(),
    type: varchar('type', { length: 100 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxEventStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('outbox_events_dispatch_idx')
      .on(table.status, table.availableAt)
      .where(sql`status IN ('pending', 'failed')`),
  ],
)

export const adminRoles = pgTable(
  'admin_roles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'restrict' }),
    role: adminRoleLevel('role').notNull(),
    grantedBy: uuid('granted_by'),
    reason: varchar('reason', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('admin_roles_role_idx').on(table.role, table.userId)],
)

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: varchar('target_id', { length: 100 }).notNull(),
    beforeSnapshot: jsonb('before_snapshot'),
    afterSnapshot: jsonb('after_snapshot'),
    reason: varchar('reason', { length: 500 }).notNull(),
    requestId: varchar('request_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admin_audit_logs_actor_created_idx').on(table.actorUserId, table.createdAt),
    index('admin_audit_logs_target_idx').on(table.targetType, table.targetId, table.createdAt),
  ],
)
