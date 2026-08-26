import { z } from 'zod'

export const deskZoneSchema = z.enum(['wall', 'shelf', 'desktop', 'foreground'])
export type DeskZone = z.infer<typeof deskZoneSchema>

export const deskItemLayoutSchema = z
  .object({
    itemId: z.uuid(),
    zone: deskZoneSchema,
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    rotation: z.number().min(-360).max(360),
    scale: z.number().positive().max(4),
    zIndex: z.number().int().min(0).max(10_000),
    flipped: z.boolean(),
  })
  .strict()
export type DeskItemLayout = z.infer<typeof deskItemLayoutSchema>

export const saveDeskLayoutSchema = z
  .object({
    layoutId: z.uuid(),
    version: z.number().int().min(1),
    idempotencyKey: z.string().trim().min(1).max(200),
    items: z.array(deskItemLayoutSchema).max(500),
  })
  .strict()
export type SaveDeskLayoutInput = z.infer<typeof saveDeskLayoutSchema>

export const rewardSourceSchema = z.enum(['session', 'node', 'topic', 'review', 'problem'])
export type RewardSource = z.infer<typeof rewardSourceSchema>

export const rewardDefinitionSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(50),
    assetKey: z.string().trim().min(1).max(200),
    allowedZones: z.array(deskZoneSchema).min(1),
    enabled: z.boolean(),
  })
  .strict()
export type RewardDefinition = z.infer<typeof rewardDefinitionSchema>

export const knowledgeNodeStatusSchema = z.enum([
  'locked',
  'available',
  'learning',
  'learned',
  'reviewing',
  'mastered',
])
export type KnowledgeNodeStatus = z.infer<typeof knowledgeNodeStatusSchema>

export const knowledgeNodeSchema = z
  .object({
    id: z.uuid(),
    topicId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(2_000).nullable(),
    status: knowledgeNodeStatusSchema,
  })
  .strict()
export type KnowledgeNode = z.infer<typeof knowledgeNodeSchema>

export const teachBackPhaseSchema = z.enum([
  'idle',
  'inviting',
  'capturing',
  'thinking',
  'asking-follow-up',
  'awaiting-answer',
  'proposing-memory',
  'confirmed',
  'skipped',
  'failed',
])
export type TeachBackPhase = z.infer<typeof teachBackPhaseSchema>

export const sharedMemoryCandidateSchema = z
  .object({
    sourceLogId: z.uuid(),
    nodeId: z.uuid().nullable(),
    originalText: z.string().trim().min(1).max(20_000),
    summary: z.string().trim().min(1).max(2_000),
    recallAt: z.iso.datetime({ offset: true }),
    dataScope: z.array(z.string().trim().min(1).max(100)).max(20),
  })
  .strict()
export type SharedMemoryCandidate = z.infer<typeof sharedMemoryCandidateSchema>

export const teachBackOutputSchema = z
  .object({
    question: z.string().trim().min(1).max(1_000),
    candidate: sharedMemoryCandidateSchema,
  })
  .strict()
export type TeachBackOutput = z.infer<typeof teachBackOutputSchema>
