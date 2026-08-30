import { describe, expect, it } from 'vitest'
import { topicSchema } from './topics.js'

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
})
