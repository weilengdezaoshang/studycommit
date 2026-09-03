import { z } from 'zod'

/** 对齐后端 papers.controller 与 rpc-contracts 的纸页契约(common 内自持一份,模式与 topic/learning-log 一致)。 */
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

export const organizePaperInputSchema = paperCommandSchema.extend({ topicId: z.uuid() })

export const deletePaperOutputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().min(2),
  deletedAt: z.iso.datetime({ offset: true }),
})

export type Paper = z.infer<typeof paperSchema>
export type PaperPage = z.infer<typeof paperPageSchema>
export type CreatePaperInput = z.infer<typeof createPaperInputSchema>
export type ListPapersInput = z.infer<typeof listPapersInputSchema>
export type UpdatePaperInput = z.infer<typeof updatePaperInputSchema>
export type OrganizePaperInput = z.infer<typeof organizePaperInputSchema>
export type PaperCommandInput = z.infer<typeof paperCommandSchema>
export type DeletePaperOutput = z.infer<typeof deletePaperOutputSchema>
