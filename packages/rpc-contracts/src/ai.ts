import { oc } from '@orpc/contract'
import { z } from 'zod'

/**
 * AI 基建契约(继续弄懂 · 直观理解,Agent 闭环 PRD v9.0/v3.0)。
 * 红线:解释卡只是候选视图,"明白了"不保存 AI 内容、不新增纸页;
 * 输出必须携带模型与 Prompt 版本以便追溯。
 */

export const explainViewTypeSchema = z.enum([
  /** 机制 -> 三段式因果链 */
  'causal_chain',
  /** 对比 -> 前后/双方对照 */
  'contrast',
  /** 实践经验 -> 检查步骤 */
  'checklist',
  /** 定义 -> 一句话定义与反例 */
  'definition_counterexample',
])

const causalChainViewSchema = z.object({
  type: z.literal('causal_chain'),
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().min(1).max(400),
      }),
    )
    .min(2)
    .max(5),
})

const contrastViewSchema = z.object({
  type: z.literal('contrast'),
  items: z
    .array(
      z.object({
        aspect: z.string().trim().min(1).max(80),
        a: z.string().trim().min(1).max(240),
        b: z.string().trim().min(1).max(240),
      }),
    )
    .min(2)
    .max(5),
})

const checklistViewSchema = z.object({
  type: z.literal('checklist'),
  steps: z
    .array(
      z.object({
        action: z.string().trim().min(1).max(160),
        reason: z.string().trim().min(1).max(280),
      }),
    )
    .min(2)
    .max(6),
})

const definitionViewSchema = z.object({
  type: z.literal('definition_counterexample'),
  definition: z.string().trim().min(1).max(400),
  counterexample: z.string().trim().min(1).max(400),
})

/** 解释卡视图:Agent 按内容类型选择,客户端只渲染与提供"换一种方式看"。 */
export const explainViewSchema = z.discriminatedUnion('type', [
  causalChainViewSchema,
  contrastViewSchema,
  checklistViewSchema,
  definitionViewSchema,
])

export const explainDirectiveSchema = z.enum(['initial', 'plainer', 'alternative'])

export const confirmPaperExplainInputSchema = z.object({ runId: z.uuid() })

export const paperExplainInputSchema = z.object({
  paperId: z.uuid().optional(),
  /** 纸页正文(AI 只读,不修改) */
  content: z.string().trim().min(1).max(20_000),
  /** 用户确认过的问题(可空) */
  questionText: z.string().trim().min(1).max(500).nullable().optional(),
  /** initial=第一张解释卡;plainer=换更浅白的说法(左推);alternative=换一种表达结构(换一种方式看) */
  directive: explainDirectiveSchema.default('initial'),
  previousViewType: explainViewTypeSchema.optional(),
  /** 已连续展示的解释卡数(客户端维护,服务端据此在第三张后收敛) */
  round: z.number().int().min(1).max(3).default(1),
})

export const paperExplainOutputSchema = z.object({
  runId: z.uuid(),
  view: explainViewSchema,
  /** 一个具体例子,帮助落地 */
  example: z.string().trim().min(1).max(800),
  /** 浅白程度 1~3;左推"还没明白"时应递增 */
  plainLevel: z.number().int().min(1).max(3),
  /** 来源信息:模型与 Prompt 版本 */
  model: z.string().min(1).max(120),
  promptVersion: z.string().min(1).max(60),
})

export const confirmPaperExplainOutputSchema = z.object({ confirmed: z.literal(true) })

export const agentRunStatusSchema = z.enum(['pending', 'completed', 'failed'])

export const aiContract = {
  explainPaper: oc
    .route({ method: 'POST', path: '/ai/papers/explain', summary: '生成直观解释卡' })
    .input(paperExplainInputSchema)
    .output(paperExplainOutputSchema),
  confirmPaperExplain: oc
    .route({ method: 'POST', path: '/ai/runs/{runId}/confirm', summary: '确认解释卡候选' })
    .input(confirmPaperExplainInputSchema)
    .output(confirmPaperExplainOutputSchema),
}

export type ExplainViewType = z.infer<typeof explainViewTypeSchema>
export type ExplainView = z.infer<typeof explainViewSchema>
export type ExplainDirective = z.infer<typeof explainDirectiveSchema>
export type PaperExplainInput = z.infer<typeof paperExplainInputSchema>
export type PaperExplainOutput = z.infer<typeof paperExplainOutputSchema>
export type ConfirmPaperExplainOutput = z.infer<typeof confirmPaperExplainOutputSchema>
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>
