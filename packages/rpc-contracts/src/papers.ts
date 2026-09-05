import { oc } from '@orpc/contract'
import { z } from 'zod'

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
})

export const createPaperInputSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  hasQuestion: z.boolean().default(false),
  /** 确认的问题文本;提供时 questionStatus 记为 thinking。 */
  questionText: z.string().trim().min(1).max(2_000).optional(),
  understandingText: z.string().trim().min(1).max(20_000).optional(),
  /** 已完成直传的上传会话 ID;创建时事务内绑定到纸页。 */
  assetUploadIds: z.array(z.uuid()).min(1).max(9).optional(),
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

export const paperPageSchema = z.object({
  items: z.array(paperSchema),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
})

const paperIdSchema = z.object({ id: z.uuid() })
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

export const paperContract = {
  create: oc
    .route({ method: 'POST', path: '/papers', successStatus: 201, summary: '记录文字内容' })
    .input(createPaperInputSchema)
    .output(paperSchema),
  list: oc
    .route({ method: 'GET', path: '/papers', summary: '查询内容时间线' })
    .input(listPapersInputSchema)
    .output(paperPageSchema),
  get: oc
    .route({ method: 'GET', path: '/papers/{id}', summary: '查看内容详情' })
    .input(paperIdSchema)
    .output(paperSchema),
  update: oc
    .route({ method: 'PATCH', path: '/papers/{id}', summary: '修改文字内容' })
    .input(updatePaperInputSchema)
    .output(paperSchema),
  organize: oc
    .route({ method: 'POST', path: '/papers/{id}/organize', summary: '整理内容到主题' })
    .input(organizePaperInputSchema)
    .output(paperSchema),
  moveToInbox: oc
    .route({ method: 'POST', path: '/papers/{id}/move-to-inbox', summary: '移回待整理' })
    .input(paperCommandSchema)
    .output(paperSchema),
  remove: oc
    .route({ method: 'DELETE', path: '/papers/{id}', summary: '删除内容' })
    .input(paperCommandSchema)
    .output(deletePaperOutputSchema),
  question: oc
    .route({ method: 'PATCH', path: '/papers/{id}/question', summary: '更新问题状态' })
    .input(updatePaperQuestionInputSchema)
    .output(paperSchema),
  restore: oc
    .route({ method: 'POST', path: '/papers/{id}/restore', summary: '恢复已删除内容' })
    .input(paperCommandSchema)
    .output(paperSchema),
}

export type Paper = z.infer<typeof paperSchema>
export type PaperPage = z.infer<typeof paperPageSchema>
export type CreatePaperInput = z.input<typeof createPaperInputSchema>
export type ListPapersInput = z.infer<typeof listPapersInputSchema>
export type UpdatePaperInput = z.infer<typeof updatePaperInputSchema>
export type OrganizePaperInput = z.infer<typeof organizePaperInputSchema>
export type PaperCommandInput = z.infer<typeof paperCommandSchema>
export type UpdatePaperQuestionInput = z.infer<typeof updatePaperQuestionInputSchema>
export type PaperQuestionStatus = z.infer<typeof paperQuestionStatusSchema>
