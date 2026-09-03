import { describe, expect, it } from 'vitest'
import { companionFollowupInputSchema, companionFollowupOutputSchema } from './ai'

describe('companion followup contract', () => {
  it('接受合法的讲解输入并去掉首尾空格', () => {
    expect(
      companionFollowupInputSchema.parse({
        sessionId: '11111111-1111-4111-8111-111111111111',
        topicId: null,
        expression: '  React 的批处理会把多次 setState 合并成一次渲染。  ',
      }),
    ).toMatchObject({ topicId: null })
  })

  it('拒绝空白讲解', () => {
    expect(companionFollowupInputSchema.safeParse({ expression: '   ' }).success).toBe(false)
  })

  it('追问数量限制在 1 到 2 条', () => {
    const base = {
      memoryDraft: { summary: '要点', gap: '缺口' },
      model: 'test-model',
      promptVersion: 'companion-followup@1',
    }
    expect(companionFollowupOutputSchema.safeParse({ ...base, questions: [] }).success).toBe(false)
    expect(
      companionFollowupOutputSchema.safeParse({
        ...base,
        questions: [{ question: 'q1' }, { question: 'q2' }, { question: 'q3' }],
      }).success,
    ).toBe(false)
    expect(
      companionFollowupOutputSchema.safeParse({ ...base, questions: [{ question: 'q1' }] }).success,
    ).toBe(true)
  })

  it('输出必须携带模型与 Prompt 版本', () => {
    expect(
      companionFollowupOutputSchema.safeParse({
        questions: [{ question: 'q1' }],
        memoryDraft: null,
      }).success,
    ).toBe(false)
  })
})
