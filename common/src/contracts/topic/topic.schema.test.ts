import { describe, expect, it } from 'vitest'
import { activeTopicFixture, activeTopicPageFixture } from './topic.fixture'
import { listActiveTopicsInputSchema, topicPageSchema, topicSchema } from './topic.schema'

describe('topic contracts', () => {
  it('accepts a real topic list page', () => {
    expect(topicSchema.parse(activeTopicFixture)).toEqual(activeTopicFixture)
    expect(topicPageSchema.parse(activeTopicPageFixture)).toEqual(activeTopicPageFixture)
  })

  it('rejects archived-only status on the list item contract when color is invalid', () => {
    expect(
      topicSchema.safeParse({
        ...activeTopicFixture,
        color: '#4f46e5',
        status: 'deleted',
      }).success,
    ).toBe(false)
  })

  it('accepts optional listActive query bounds', () => {
    expect(listActiveTopicsInputSchema.parse({})).toEqual({})
    expect(listActiveTopicsInputSchema.parse({ limit: 100, cursor: 'abc' })).toEqual({
      limit: 100,
      cursor: 'abc',
    })
    expect(listActiveTopicsInputSchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(listActiveTopicsInputSchema.safeParse({ extra: true }).success).toBe(false)
  })
})
