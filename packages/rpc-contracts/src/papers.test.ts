import { describe, expect, it } from 'vitest'
import {
  createPaperInputSchema,
  listPapersInputSchema,
  paperContract,
  paperSchema,
  updatePaperQuestionInputSchema,
} from './papers.js'

describe('paper contract', () => {
  it('声明内容的创建、查询、整理和删除路由', () => {
    expect(paperContract.create['~orpc'].route).toMatchObject({ method: 'POST', path: '/papers' })
    expect(paperContract.organize['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/papers/{id}/organize',
    })
    expect(paperContract.remove['~orpc'].route).toMatchObject({
      method: 'DELETE',
      path: '/papers/{id}',
    })
    expect(paperContract.question['~orpc'].route).toMatchObject({
      method: 'PATCH',
      path: '/papers/{id}/question',
    })
    expect(paperContract.restore['~orpc'].route).toMatchObject({
      method: 'POST',
      path: '/papers/{id}/restore',
    })
  })

  it('接受文字记录或纯图片记录并拒绝完全空记录', () => {
    expect(createPaperInputSchema.parse({ content: '  一段记录  ' })).toEqual({
      content: '一段记录',
      hasQuestion: false,
    })
    expect(createPaperInputSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(
      createPaperInputSchema.parse({
        content: '   ',
        assetUploadIds: ['0b8f3c64-6e2a-4a5d-9d0a-2f0f5d3a1b21'],
      }),
    ).toMatchObject({ content: '', assetUploadIds: [expect.any(String)] })
    expect(createPaperInputSchema.safeParse({ content: 'a'.repeat(20_001) }).success).toBe(false)
  })

  it('纯图片记录标记问题时需要正文或问题文本', () => {
    const assetUploadIds = ['0b8f3c64-6e2a-4a5d-9d0a-2f0f5d3a1b21']
    expect(createPaperInputSchema.safeParse({ assetUploadIds, hasQuestion: true }).success).toBe(
      false,
    )
    expect(
      createPaperInputSchema.safeParse({
        assetUploadIds,
        hasQuestion: true,
        questionText: '这张图哪里需要继续理解？',
      }).success,
    ).toBe(true)
  })

  it('拒绝重复绑定同一个图片上传会话', () => {
    const uploadId = '0b8f3c64-6e2a-4a5d-9d0a-2f0f5d3a1b21'
    expect(
      createPaperInputSchema.safeParse({ content: '', assetUploadIds: [uploadId, uploadId] })
        .success,
    ).toBe(false)
  })

  it('创建时接受确认的问题与理解文本并去除首尾空白', () => {
    const parsed = createPaperInputSchema.parse({
      content: '内容',
      questionText: '  为什么状态更新不是立即生效  ',
      understandingText: ' 因为有批处理 ',
    })
    expect(parsed.questionText).toBe('为什么状态更新不是立即生效')
    expect(parsed.understandingText).toBe('因为有批处理')
    expect(createPaperInputSchema.safeParse({ content: '内容', questionText: '  ' }).success).toBe(
      false,
    )
    expect(
      createPaperInputSchema.safeParse({ content: '内容', questionText: 'a'.repeat(2_001) })
        .success,
    ).toBe(false)
  })

  it('禁止待整理状态同时按主题筛选', () => {
    expect(
      listPapersInputSchema.safeParse({ status: 'inbox', topicId: crypto.randomUUID() }).success,
    ).toBe(false)
  })

  it('按问题状态筛选只接受 thinking、resolved 和 all', () => {
    expect(listPapersInputSchema.parse({ questionStatus: 'thinking' }).questionStatus).toBe(
      'thinking',
    )
    expect(listPapersInputSchema.parse({ questionStatus: 'all' }).questionStatus).toBe('all')
    expect(listPapersInputSchema.safeParse({ questionStatus: 'none' }).success).toBe(false)
  })

  it('更新问题状态必须提供目标状态且文本非空', () => {
    const id = crypto.randomUUID()
    expect(
      updatePaperQuestionInputSchema.parse({ id, version: 2, status: 'resolved' }),
    ).toMatchObject({ id, version: 2, status: 'resolved' })
    expect(
      updatePaperQuestionInputSchema.parse({
        id,
        version: 2,
        status: 'thinking',
        questionText: '  问题  ',
      }),
    ).toMatchObject({ questionText: '问题' })
    expect(
      updatePaperQuestionInputSchema.safeParse({ id, version: 2, status: 'thinking' }).success,
    ).toBe(true)
    expect(
      updatePaperQuestionInputSchema.safeParse({ id, version: 2, status: 'none', questionText: '' })
        .success,
    ).toBe(false)
  })

  it('输出状态由主题关系表达', () => {
    const now = new Date().toISOString()
    expect(
      paperSchema.parse({
        id: crypto.randomUUID(),
        content: '内容',
        status: 'inbox',
        topicId: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).status,
    ).toBe('inbox')
  })

  it('输出默认补齐问题三态字段', () => {
    const now = new Date().toISOString()
    const paper = paperSchema.parse({
      id: crypto.randomUUID(),
      content: '内容',
      status: 'inbox',
      topicId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    expect(paper.questionStatus).toBe('none')
    expect(paper.questionText).toBeNull()
    expect(paper.understandingText).toBeNull()
    expect(paper.questionResolvedAt).toBeNull()
  })
})
