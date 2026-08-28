import { oc } from '@orpc/contract'
import { z } from 'zod'

export const paperBackgroundSchema = z.enum(['plain', 'dot', 'rule', 'grid'])

export const templateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(18),
  icon: z.string().trim().min(1).max(100),
  paperBackground: paperBackgroundSchema,
  version: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
})

export const templateSummarySchema = templateSchema.pick({
  id: true,
  name: true,
  icon: true,
  paperBackground: true,
})

export const templateListSchema = z.object({
  items: z.array(templateSchema),
})

export const templateContract = {
  list: oc
    .route({ method: 'GET', path: '/templates', summary: '查询可用模板' })
    .output(templateListSchema),
}

export type Template = z.infer<typeof templateSchema>
export type TemplateSummary = z.infer<typeof templateSummarySchema>
export type TemplateList = z.infer<typeof templateListSchema>
