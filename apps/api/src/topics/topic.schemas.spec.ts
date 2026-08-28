import { describe, expect, it } from 'vitest'
import { DEFAULT_TOPIC_COLOR } from '../templates/template.constants'
import { createTopicSchema, updateTopicSchema } from './topic.schemas'

describe('topic schemas', () => {
  it('trims names and normalizes color', () =>
    expect(createTopicSchema.parse({ name: ' Node ', color: '#4f46e5' })).toMatchObject({
      name: 'Node',
      color: '#4F46E5',
      status: 'active',
    }))
  it('rejects invalid fields and color', () =>
    expect(() => createTopicSchema.parse({ name: '', color: 'red', userId: 'fake' })).toThrow())
  it('requires a patch field besides version', () =>
    expect(() => updateTopicSchema.parse({ version: 1 })).toThrow())

  it('只填名称时补默认颜色且允许省略模板', () => {
    expect(createTopicSchema.parse({ name: ' 系统设计 ' })).toMatchObject({
      name: '系统设计',
      color: DEFAULT_TOPIC_COLOR,
    })
    expect(createTopicSchema.parse({ name: '系统设计' }).templateId).toBeUndefined()
  })

  it('名称超过十八个字符时拒绝', () => {
    expect(
      createTopicSchema.safeParse({ name: 'abcdefghijklmnopqrs', color: '#DCE9D8' }).success,
    ).toBe(false)
  })
})
