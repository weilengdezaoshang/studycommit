import { describe, expect, it } from 'vitest'
import { templateContract, templateSchema } from './templates.js'

describe('template contract', () => {
  it('声明查询可用模板路由', () => {
    expect(templateContract.list['~orpc'].route).toMatchObject({
      method: 'GET',
      path: '/templates',
    })
  })

  it('模板包含箱子图标和纸页背景', () => {
    const now = new Date().toISOString()
    expect(
      templateSchema.parse({
        id: crypto.randomUUID(),
        name: '空白',
        icon: 'box',
        paperBackground: 'plain',
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    ).toMatchObject({ icon: 'box', paperBackground: 'plain' })
    expect(
      templateSchema.safeParse({
        id: crypto.randomUUID(),
        name: '空白',
        icon: 'box',
        paperBackground: 'photo',
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).success,
    ).toBe(false)
  })
})
