import { describe, expect, it } from 'vitest'
import { createTopicInputSchema, loginInputSchema, startStudySessionInputSchema } from './index.js'

describe('rpc contracts', () => {
  it('applies safe defaults for topic creation', () => {
    expect(createTopicInputSchema.parse({ name: 'TypeScript', color: '#F4D35E' })).toEqual({
      name: 'TypeScript',
      description: undefined,
      color: '#F4D35E',
      status: 'active',
    })
  })

  it('rejects unsupported login providers', () => {
    expect(() => loginInputSchema.parse({ provider: 'google', credential: 'x' })).toThrow()
  })

  it('requires an idempotency key when starting a session', () => {
    expect(() => startStudySessionInputSchema.parse({ topicId: 'topic-1', goal: '' })).toThrow()
  })
})
