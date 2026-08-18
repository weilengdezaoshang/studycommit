import { HttpError } from '@studycommit/common/http'

const mockExpoConfig = {
  extra: {
    studycommitApiOrigin: undefined as string | undefined,
    studycommitApiPrefix: undefined as string | undefined,
    studycommitDevUserId: undefined as string | undefined,
  },
}

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockExpoConfig
    },
  },
}))

import {
  createDevelopmentHeaderProvider,
  getMobileApiOrigin,
  getMobileApiPrefix,
  getMobileDevelopmentUserId,
} from './api-config'

describe('mobile api config', () => {
  const originalOrigin = process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
  const originalPrefix = process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX

  afterEach(() => {
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN = originalOrigin
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX = originalPrefix
    mockExpoConfig.extra.studycommitApiOrigin = undefined
    mockExpoConfig.extra.studycommitApiPrefix = undefined
    mockExpoConfig.extra.studycommitDevUserId = undefined
  })

  it('reads a valid origin and default prefix', () => {
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN = 'http://10.0.2.2:3000'
    delete process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX
    expect(getMobileApiOrigin()).toBe('http://10.0.2.2:3000')
    expect(getMobileApiPrefix()).toBe('/api')
  })

  it('maps a missing origin to CONFIGURATION_ERROR', () => {
    delete process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
    expect(() => getMobileApiOrigin()).toThrow(HttpError)
  })

  it('prefers Expo extra origin when Metro did not inline EXPO_PUBLIC', () => {
    delete process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
    mockExpoConfig.extra.studycommitApiOrigin = 'http://localhost:3000'
    expect(getMobileApiOrigin()).toBe('http://localhost:3000')
  })

  it('injects the development identity through the header provider', async () => {
    await expect(
      createDevelopmentHeaderProvider('11111111-1111-4111-8111-111111111111')(),
    ).resolves.toEqual({
      accept: 'application/json',
      'x-user-id': '11111111-1111-4111-8111-111111111111',
    })
  })

  it('reads the development identity from Expo extra and not EXPO_PUBLIC', () => {
    mockExpoConfig.extra.studycommitDevUserId = '11111111-1111-4111-8111-111111111111'
    expect(getMobileDevelopmentUserId()).toBe('11111111-1111-4111-8111-111111111111')
  })
})
