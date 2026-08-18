import { afterEach, describe, expect, it } from 'vitest'
import { createIdempotencyKey, setIdempotencyKeyProvider } from './create-idempotency-key'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('createIdempotencyKey', () => {
  afterEach(() => {
    setIdempotencyKeyProvider(null)
  })

  it('returns a uuid from the platform crypto api', () => {
    const first = createIdempotencyKey()
    const second = createIdempotencyKey()
    expect(first).toMatch(uuidPattern)
    expect(first).not.toBe(second)
  })

  it('uses the registered provider first', () => {
    setIdempotencyKeyProvider(() => '11111111-1111-4111-8111-111111111111')
    expect(createIdempotencyKey()).toBe('11111111-1111-4111-8111-111111111111')
  })
})
