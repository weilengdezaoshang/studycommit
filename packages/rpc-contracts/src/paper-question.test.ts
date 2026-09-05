import { describe, expect, it } from 'vitest'
import { planQuestionTransition, questionStatusOfBooleans } from './paper-question.js'

describe('paper question machine', () => {
  it('从无问题设置问题需要问题文本', () => {
    const result = planQuestionTransition({
      current: 'none',
      command: { status: 'thinking', questionText: '  为什么会这样  ' },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan).toMatchObject({
        questionStatus: 'thinking',
        questionText: '为什么会这样',
        questionResolvedAt: 'clear',
        changed: true,
        hasQuestion: true,
        isQuestionResolved: false,
      })
    }
  })

  it('从无问题设置问题但文本为空时拒绝并给出中文提示', () => {
    for (const questionText of [undefined, '   ']) {
      const result = planQuestionTransition({
        current: 'none',
        command: { status: 'thinking', questionText },
      })
      expect(result).toMatchObject({
        ok: false,
        reason: 'question_text_required',
        message: '设置问题需要先写下问题内容',
      })
    }
  })

  it('从无问题直接标记解决属于非法迁移', () => {
    expect(
      planQuestionTransition({ current: 'none', command: { status: 'resolved' } }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid_transition',
      message: '问题状态不能这样切换',
    })
  })

  it('解决问题时记录当前时间并保持问题文本', () => {
    const result = planQuestionTransition({
      current: 'thinking',
      command: { status: 'resolved' },
      currentQuestionText: '为什么会这样',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan).toMatchObject({
        questionStatus: 'resolved',
        questionText: '为什么会这样',
        questionResolvedAt: 'now',
        changed: true,
        hasQuestion: true,
        isQuestionResolved: true,
      })
    }
  })

  it('重新打开问题时清空解决时间并沿用原问题文本', () => {
    const result = planQuestionTransition({
      current: 'resolved',
      command: { status: 'thinking' },
      currentQuestionText: '为什么会这样',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan).toMatchObject({
        questionStatus: 'thinking',
        questionText: '为什么会这样',
        questionResolvedAt: 'clear',
        changed: true,
        isQuestionResolved: false,
      })
    }
  })

  it('移除问题时清空问题文本和解决时间', () => {
    for (const current of ['thinking', 'resolved'] as const) {
      const result = planQuestionTransition({ current, command: { status: 'none' } })
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.plan).toMatchObject({
          questionStatus: 'none',
          questionText: null,
          questionResolvedAt: 'clear',
          changed: true,
          hasQuestion: false,
          isQuestionResolved: false,
        })
      }
    }
  })

  it('已解决的问题更新文本保持首次解决时间', () => {
    const result = planQuestionTransition({
      current: 'resolved',
      command: { status: 'resolved', questionText: '换一种问法' },
      currentQuestionText: '为什么会这样',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan).toMatchObject({
        questionStatus: 'resolved',
        questionText: '换一种问法',
        questionResolvedAt: 'keep',
        changed: true,
      })
    }
  })

  it('同状态且文本未变化时按幂等处理不递增版本', () => {
    const sameText = planQuestionTransition({
      current: 'thinking',
      command: { status: 'thinking', questionText: '为什么会这样' },
      currentQuestionText: '为什么会这样',
    })
    const noText = planQuestionTransition({
      current: 'thinking',
      command: { status: 'thinking' },
      currentQuestionText: '为什么会这样',
    })
    const resolvedSame = planQuestionTransition({
      current: 'resolved',
      command: { status: 'resolved' },
      currentQuestionText: '为什么会这样',
    })
    const noneSame = planQuestionTransition({ current: 'none', command: { status: 'none' } })
    expect(sameText.ok && !sameText.plan.changed).toBe(true)
    expect(noText.ok && !noText.plan.changed).toBe(true)
    expect(resolvedSame.ok && !resolvedSame.plan.changed).toBe(true)
    expect(noneSame.ok && !noneSame.plan.changed).toBe(true)
  })

  it('从旧布尔字段推导三态', () => {
    expect(questionStatusOfBooleans(true, true)).toBe('resolved')
    expect(questionStatusOfBooleans(true, false)).toBe('thinking')
    expect(questionStatusOfBooleans(false, false)).toBe('none')
    // AI 确认产物:未标记问题却写了解决布尔,按无问题归一
    expect(questionStatusOfBooleans(false, true)).toBe('none')
  })
})
