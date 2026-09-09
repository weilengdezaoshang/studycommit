import { describe, expect, it } from 'vitest'
import { notesRecord, validateDialogField } from './index'

describe('dialog field rules', () => {
  it('datetime-local 字段校验格式与下限', () => {
    const field = {
      label: '结束时间',
      type: 'datetime-local' as const,
      defaultValue: '2026-09-09T10:00',
      min: '2026-09-01T08:00',
    }
    expect(validateDialogField(field, '2026-09-02T09:00')).toBeNull()
    expect(validateDialogField(field, '2026-08-31T09:00')).not.toBeNull()
    expect(validateDialogField(field, '')).not.toBeNull()
  })

  it('文本字段仅在 required 时校验非空', () => {
    const field = { label: '主题名称', type: 'text' as const, defaultValue: '', required: true }
    expect(validateDialogField(field, '')).toBe('请填写主题名称')
    expect(validateDialogField(field, '   ')).toBe('请填写主题名称')
    expect(validateDialogField(field, '堆与优先队列')).toBeNull()
    expect(validateDialogField({ ...field, required: false }, '')).toBeNull()
    expect(validateDialogField(undefined, '')).toBeNull()
  })

  it('备注字段按 defaultValue 初始化键值表', () => {
    expect(
      notesRecord([
        { key: 'understanding', label: '理解' },
        { key: 'nextQuestion', label: '下一个问题', defaultValue: '预填' },
      ]),
    ).toEqual({ understanding: '', nextQuestion: '预填' })
    expect(notesRecord(undefined)).toEqual({})
  })
})
