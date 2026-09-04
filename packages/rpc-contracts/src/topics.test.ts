import { describe, expect, it } from 'vitest'
import {
  createTopicInputSchema,
  removeTopicInputSchema,
  removeTopicOutputSchema,
  topicContract,
  topicSchema,
  updateTopicInputSchema,
} from './topics.js'

describe('topic contract', () => {
  it('箱子输出包含有效纸页数量和最近更新时间', () => {
    const now = new Date().toISOString()
    expect(
      topicSchema.parse({
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        name: '系统设计',
        description: null,
        color: '#DCE9D8',
        templateId: crypto.randomUUID(),
        template: {
          id: crypto.randomUUID(),
          name: '空白',
          icon: 'box',
          paperBackground: 'plain',
        },
        status: 'active',
        totalDurationSeconds: 0,
        paperCount: 2,
        lastPaperAt: now,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }),
    ).toMatchObject({ paperCount: 2, lastPaperAt: now })
  })

  it('创建输入会保留客户端可省略的默认字段', () => {
    expect(createTopicInputSchema.parse({ name: '系统设计' })).toEqual({
      name: '系统设计',
      status: 'active',
    })
  })

  it('更新输入会规范化名称和颜色并要求版本', () => {
    expect(
      updateTopicInputSchema.parse({
        id: crypto.randomUUID(),
        name: ' 系统设计 ',
        color: '#dce9d8',
        version: 1,
      }),
    ).toMatchObject({ name: '系统设计', color: '#DCE9D8', version: 1 })
  })

  it('更新输入不能只提交版本', () => {
    expect(() => updateTopicInputSchema.parse({ id: crypto.randomUUID(), version: 1 })).toThrow()
  })

  it('删除输入和输出分别携带版本与软删除时间', () => {
    const id = crypto.randomUUID()
    expect(removeTopicInputSchema.parse({ id, version: 2 })).toEqual({ id, version: 2 })
    expect(
      removeTopicOutputSchema.parse({ id, version: 3, deletedAt: new Date().toISOString() }),
    ).toMatchObject({ id, version: 3 })
  })

  it('箱子路由覆盖查询、创建、更新和删除操作', () => {
    expect(Object.keys(topicContract)).toEqual(['list', 'get', 'create', 'update', 'remove'])
  })
})
