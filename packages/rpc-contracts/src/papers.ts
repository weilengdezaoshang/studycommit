import { oc } from '@orpc/contract'
import { z } from 'zod'

export const paperStatusSchema = z.enum(['inbox', 'organized'])

export const paperSchema = z.object({
  id: z.uuid(),
  content: z.string().min(1).max(20_000),
  status: paperStatusSchema,
  topicId: z.uuid().nullable(),
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const createPaperInputSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
})

export const listPapersInputSchema = z
  .object({
    status: paperStatusSchema.optional(),
    topicId: z.uuid().optional(),
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
const paperCommandSchema = z.object({ id: z.uuid(), version: z.number().int().min(1) })

export const updatePaperInputSchema = paperCommandSchema.extend({
  content: z.string().trim().min(1).max(20_000),
})

export const organizePaperInputSchema = paperCommandSchema.extend({ topicId: z.uuid() })

export const deletePaperOutputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(2),
  deletedAt: z.iso.datetime({ offset: true }),
})

export const paperContract = {
  create: oc
    .route({ method: 'POST', path: '/papers', summary: '记录文字内容' })
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
}

export type Paper = z.infer<typeof paperSchema>
export type PaperPage = z.infer<typeof paperPageSchema>
export type CreatePaperInput = z.infer<typeof createPaperInputSchema>
export type ListPapersInput = z.infer<typeof listPapersInputSchema>
export type UpdatePaperInput = z.infer<typeof updatePaperInputSchema>
export type OrganizePaperInput = z.infer<typeof organizePaperInputSchema>
export type PaperCommandInput = z.infer<typeof paperCommandSchema>
