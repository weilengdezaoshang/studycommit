import { describe, expect, it } from 'vitest'
import { createTopicSchema, updateTopicSchema } from './topic.schemas'
describe('topic schemas', () => {
  it('trims names and normalizes color', () => expect(createTopicSchema.parse({ name: ' Node ', color: '#4f46e5' })).toMatchObject({ name: 'Node', color: '#4F46E5', status: 'active' }))
  it('rejects invalid fields and color', () => expect(() => createTopicSchema.parse({ name: '', color: 'red', userId: 'fake' })).toThrow())
  it('requires a patch field besides version', () => expect(() => updateTopicSchema.parse({ version: 1 })).toThrow())
})
