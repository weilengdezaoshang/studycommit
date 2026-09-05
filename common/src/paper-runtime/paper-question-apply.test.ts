import { describe, expect, it } from 'vitest'
import type { Paper } from '../contracts/paper/paper.schema'
import {
  applyQuestionCommand,
  applyQuestionConfirmed,
  questionExtrasOf,
  questionFieldsForCreate,
} from './paper-question-apply'

const thinkingPaper: Paper = {
  id: '3f0f9d92-58a2-4c6e-9f7a-1d1c2b3a4e5f',
  content: '为什么状态更新不是立即生效',
  status: 'inbox',
  topicId: null,
  version: 2,
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  deletedAt: null,
  hasQuestion: true,
  isQuestionResolved: false,
  questionStatus: 'thinking',
  questionText: '批处理解决了什么问题',
  understandingText: null,
  questionResolvedAt: null,
}

describe('paper question apply', () => {
  it('乐观解决问题时补齐解决时间并递增版本', () => {
    const next = applyQuestionCommand(
      thinkingPaper,
      { status: 'resolved' },
      '2026-09-02T10:00:00.000Z',
    )
    expect(next).toMatchObject({
      questionStatus: 'resolved',
      questionText: '批处理解决了什么问题',
      questionResolvedAt: '2026-09-02T10:00:00.000Z',
      hasQuestion: true,
      isQuestionResolved: true,
      version: 3,
      updatedAt: '2026-09-02T10:00:00.000Z',
    })
    expect(next.content).toBe(thinkingPaper.content)
  })

  it('非法迁移与幂等命令原样返回纸页', () => {
    const nonePaper = {
      ...thinkingPaper,
      questionStatus: 'none' as const,
      questionText: null,
      hasQuestion: false,
    }
    expect(
      applyQuestionCommand(nonePaper, { status: 'resolved' }, '2026-09-02T10:00:00.000Z'),
    ).toBe(nonePaper)
    expect(
      applyQuestionCommand(thinkingPaper, { status: 'thinking' }, '2026-09-02T10:00:00.000Z'),
    ).toBe(thinkingPaper)
  })

  it('重新打开时清空解决时间', () => {
    const resolved = {
      ...thinkingPaper,
      questionStatus: 'resolved' as const,
      isQuestionResolved: true,
      questionResolvedAt: '2026-09-01T12:00:00.000Z',
    }
    expect(
      applyQuestionCommand(resolved, { status: 'thinking' }, '2026-09-02T10:00:00.000Z'),
    ).toMatchObject({
      questionStatus: 'thinking',
      questionResolvedAt: null,
      isQuestionResolved: false,
      version: 3,
    })
  })

  it('AI 解释卡确认后仅在还在思考时落定为已解决', () => {
    const confirmed = applyQuestionConfirmed(thinkingPaper, '2026-09-02T10:00:00.000Z')
    expect(confirmed).toMatchObject({
      questionStatus: 'resolved',
      questionResolvedAt: '2026-09-02T10:00:00.000Z',
      version: 3,
    })
    const alreadyResolved = { ...thinkingPaper, questionStatus: 'resolved' as const }
    expect(applyQuestionConfirmed(alreadyResolved, '2026-09-02T10:00:00.000Z')).toBe(
      alreadyResolved,
    )
  })

  it('侧车字段从纸页派生', () => {
    expect(questionExtrasOf(thinkingPaper)).toEqual({
      hasQuestion: true,
      isQuestionResolved: false,
      questionStatus: 'thinking',
    })
  })

  it('创建字段按问题文本或疑问标记推导', () => {
    expect(questionFieldsForCreate({ content: '一段记录', questionText: '为什么' })).toEqual({
      questionStatus: 'thinking',
      questionText: '为什么',
    })
    expect(
      questionFieldsForCreate({ content: '为什么是这样的一段记录', hasQuestion: true }),
    ).toEqual({
      questionStatus: 'thinking',
      questionText: '为什么是这样的一段记录',
    })
    expect(questionFieldsForCreate({ content: '一段记录' })).toEqual({
      questionStatus: 'none',
      questionText: null,
    })
  })

  it('创建时正文超过 2000 字截断充当问题文本', () => {
    const longContent = '问'.repeat(2_100)
    expect(questionFieldsForCreate({ content: longContent, hasQuestion: true }).questionText).toBe(
      '问'.repeat(2_000),
    )
  })
})
