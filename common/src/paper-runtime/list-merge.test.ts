import { describe, expect, it } from 'vitest'
import type { Paper } from '@studycommit/rpc-contracts/papers'
import { mergeListedPaper } from './list-merge'

const document = {
  version: 1 as const,
  doc: {
    type: 'doc' as const,
    content: [
      { type: 'paragraph' as const, content: [{ type: 'text' as const, text: '云端纸页内容' }] },
    ],
  },
}

function paper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: '9a111111-1111-4111-8111-111111111111',
    content: '云端纸页内容',
    status: 'inbox',
    topicId: null,
    version: 1,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    deletedAt: null,
    hasQuestion: false,
    isQuestionResolved: false,
    questionStatus: 'none',
    questionText: null,
    understandingText: null,
    questionResolvedAt: null,
    ...overrides,
  }
}

describe('mergeListedPaper', () => {
  it('列表省略文档时保留同版本已加载的富文本', () => {
    const listed = paper()
    const opened = paper({ contentDocument: document })
    expect(mergeListedPaper(opened, listed).contentDocument).toEqual(document)
  })

  it('版本变化后丢弃过期文档', () => {
    const listed = paper({ version: 2, content: '已修订' })
    const opened = paper({ contentDocument: document })
    expect(mergeListedPaper(opened, listed).contentDocument).toBeUndefined()
  })

  it('服务端带回文档时以服务端为准', () => {
    const incoming = paper({ contentDocument: null })
    const opened = paper({ contentDocument: document })
    expect(mergeListedPaper(opened, incoming).contentDocument).toBeNull()
  })
})
