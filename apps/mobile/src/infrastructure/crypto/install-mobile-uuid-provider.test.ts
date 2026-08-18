import { createIdempotencyKey } from '@studycommit/common/study-session-runtime'

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '22222222-2222-4222-8222-222222222222'),
}))

import { installMobileUuidProvider } from './install-mobile-uuid-provider'

describe('installMobileUuidProvider', () => {
  it('registers expo-crypto as the idempotency key source', () => {
    installMobileUuidProvider()
    expect(createIdempotencyKey()).toBe('22222222-2222-4222-8222-222222222222')
  })
})
