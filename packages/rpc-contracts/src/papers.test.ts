import { describe, expect, it } from 'vitest'
import {
  createPaperInputSchema,
  listPapersInputSchema,
  paperContract,
  paperSchema,
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
  })

  it('只接受非空纯文字内容', () => {
    expect(createPaperInputSchema.parse({ content: '  一段记录  ' })).toEqual({
      content: '一段记录',
      hasQuestion: false,
    })
    expect(createPaperInputSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(createPaperInputSchema.safeParse({ content: 'a'.repeat(20_001) }).success).toBe(false)
  })

  it('禁止待整理状态同时按主题筛选', () => {
    expect(
      listPapersInputSchema.safeParse({ status: 'inbox', topicId: crypto.randomUUID() }).success,
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
})
