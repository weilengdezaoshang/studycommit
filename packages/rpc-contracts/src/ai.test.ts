import { describe, expect, it } from 'vitest'
import { explainViewSchema, paperExplainInputSchema, paperExplainOutputSchema } from './ai.js'

describe('paper explain contract', () => {
  it('接受纸页正文与指令并去掉首尾空格', () => {
    expect(
      paperExplainInputSchema.parse({
        content: '  React 的批处理会把多次 setState 合并成一次渲染。  ',
        questionText: null,
      }),
    ).toMatchObject({ directive: 'initial', round: 1 })
  })

  it('拒绝空正文与越界的轮次', () => {
    expect(paperExplainInputSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(paperExplainInputSchema.safeParse({ content: '内容', round: 4 }).success).toBe(false)
  })

  it('解释卡支持四种结构视图', () => {
    expect(
      explainViewSchema.safeParse({
        type: 'causal_chain',
        steps: [
          { title: '触发', detail: '连续调用 setState' },
          { title: '合并', detail: '更新进入队列等待' },
        ],
      }).success,
    ).toBe(true)
    expect(
      explainViewSchema.safeParse({
        type: 'contrast',
        items: [
          { aspect: '更新时机', a: '同步', b: '批处理' },
          { aspect: '渲染次数', a: '多次', b: '一次' },
        ],
      }).success,
    ).toBe(true)
    expect(
      explainViewSchema.safeParse({
        type: 'checklist',
        steps: [
          { action: '先跑事件回调', reason: '收集全部更新' },
          { action: '统一渲染', reason: '减少重复渲染' },
        ],
      }).success,
    ).toBe(true)
    expect(
      explainViewSchema.safeParse({
        type: 'definition_counterexample',
        definition: '批处理是合并多次更新',
        counterexample: '每次 setState 都立刻渲染是错的',
      }).success,
    ).toBe(true)
    expect(explainViewSchema.safeParse({ type: 'mind_map' }).success).toBe(false)
  })

  it('输出必须携带模型与 Prompt 版本,浅白程度限制在 1~3', () => {
    const base = {
      runId: '11111111-1111-4111-8111-111111111111',
      view: {
        type: 'causal_chain',
        steps: [
          { title: 'a', detail: 'b' },
          { title: 'c', detail: 'd' },
        ],
      },
      example: '例子',
      plainLevel: 1,
      model: 'test-model',
      promptVersion: 'paper-explain@1',
    }
    expect(paperExplainOutputSchema.safeParse(base).success).toBe(true)
    expect(paperExplainOutputSchema.safeParse({ ...base, plainLevel: 4 }).success).toBe(false)
    expect(
      paperExplainOutputSchema.safeParse({
        ...base,
        model: undefined,
        promptVersion: undefined,
      }).success,
    ).toBe(false)
  })
})
