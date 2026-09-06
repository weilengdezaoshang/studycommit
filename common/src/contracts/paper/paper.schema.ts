import { z } from 'zod'

/**
 * 对齐后端 papers.controller 与 rpc-contracts 的纸页契约(common 内自持一份,模式与 topic/learning-log 一致)。
 * 同步义务:修改本文件时必须同步 `packages/rpc-contracts/src/papers.ts`,两份 schema 有 parity 测试守护。
 */
export const paperStatusSchema = z.enum(['inbox', 'organized'])

/** 问题三态:none 无问题 / thinking 还在思考 / resolved 已解决。 */
export const paperQuestionStatusSchema = z.enum(['none', 'thinking', 'resolved'])

export const paperSchema = z.object({
  id: z.uuid(),
  content: z.string().min(1).max(20_000),
  status: paperStatusSchema,
  topicId: z.uuid().nullable(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
  hasQuestion: z.boolean().default(false),
  isQuestionResolved: z.boolean().default(false),
  questionStatus: paperQuestionStatusSchema.default('none'),
  questionText: z.string().max(2_000).nullable().default(null),
  understandingText: z.string().max(20_000).nullable().default(null),
  questionResolvedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  /** 纸页来源:移动端直记 / 桌面截图 / 桌面收尾创建;旧读取方可缺省。 */
  source: z.enum(['mobile_direct', 'desktop_capture', 'desktop_session']).optional(),
  /** 来源学习会话;桌面收尾创建的"下一个问题"回链会话。 */
  sourceSessionId: z.uuid().nullable().optional(),
})

export const createPaperInputSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  hasQuestion: z.boolean().default(false),
  /** 确认的问题文本;提供时 questionStatus 记为 thinking。 */
  questionText: z.string().trim().min(1).max(2_000).optional(),
  understandingText: z.string().trim().min(1).max(20_000).optional(),
})

export const listPapersInputSchema = z
  .object({
    status: paperStatusSchema.optional(),
    topicId: z.uuid().optional(),
    /** 问题状态筛选;all 表示有问题(thinking 或 resolved)。 */
    questionStatus: z.enum(['thinking', 'resolved', 'all']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().min(1).optional(),
  })
  .refine((value) => value.status !== 'inbox' || value.topicId === undefined, {
    message: '待整理内容不能同时按主题筛选',
    path: ['topicId'],
  })

export const paperPageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
})

export const paperPageSchema = z.object({
  items: z.array(paperSchema),
  pageInfo: paperPageInfoSchema,
})

export const paperCommandSchema = z.object({ id: z.uuid(), version: z.number().int().min(1) })

export const updatePaperInputSchema = paperCommandSchema.extend({
  content: z.string().trim().min(1).max(20_000),
})

/** 更新问题状态的目标状态;questionText 仅在建立/修改问题时提供。 */
export const updatePaperQuestionInputSchema = paperCommandSchema.extend({
  status: paperQuestionStatusSchema,
  questionText: z.string().trim().min(1).max(2_000).optional(),
})

export const organizePaperInputSchema = paperCommandSchema.extend({ topicId: z.uuid() })

export const deletePaperOutputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(2),
  deletedAt: z.iso.datetime({ offset: true }),
})

export type Paper = z.infer<typeof paperSchema>
export type PaperPage = z.infer<typeof paperPageSchema>
export type CreatePaperInput = z.input<typeof createPaperInputSchema>
export type ListPapersInput = z.infer<typeof listPapersInputSchema>
export type UpdatePaperInput = z.infer<typeof updatePaperInputSchema>
export type OrganizePaperInput = z.infer<typeof organizePaperInputSchema>
export type PaperCommandInput = z.infer<typeof paperCommandSchema>
export type UpdatePaperQuestionInput = z.infer<typeof updatePaperQuestionInputSchema>
export type PaperQuestionStatus = z.infer<typeof paperQuestionStatusSchema>
export type DeletePaperOutput = z.infer<typeof deletePaperOutputSchema>
