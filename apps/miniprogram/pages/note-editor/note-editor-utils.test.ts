import { describe, expect, it } from 'vitest'
import { formatEditorDate, parseNoteDraft } from './note-editor-utils'

describe('note-editor-utils', () => {
  it('兼容旧版字符串草稿', () => {
    expect(parseNoteDraft('旧草稿')).toEqual({
      content: '旧草稿',
      isQuestionActive: false,
      photoPath: '',
    })
  })

  it('恢复正文图片和问题标记草稿', () => {
    expect(
      parseNoteDraft({ content: '草稿', isQuestionActive: true, photoPath: '/saved/photo.jpg' }),
    ).toEqual({ content: '草稿', isQuestionActive: true, photoPath: '/saved/photo.jpg' })
  })

  it('根据当前日期生成编辑器日期', () => {
    expect(formatEditorDate(new Date(2026, 7, 28, 12))).toEqual({
      dateLabel: '8月28日',
      signatureLabel: '2026 · STUDYCOMMIT',
    })
  })
})
