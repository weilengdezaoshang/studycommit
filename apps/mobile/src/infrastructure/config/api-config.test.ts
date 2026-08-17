import { HttpError } from '@studycommit/common/http'
import {
  createDevelopmentHeaderProvider,
  getMobileApiOrigin,
  getMobileApiPrefix,
} from './api-config'

describe('mobile api config', () => {
  const originalOrigin = process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
  const originalPrefix = process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX

  afterEach(() => {
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN = originalOrigin
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_PREFIX = originalPrefix
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

  it('injects the development identity through the header provider', async () => {
    await expect(
      createDevelopmentHeaderProvider('11111111-1111-4111-8111-111111111111')(),
    ).resolves.toEqual({
      accept: 'application/json',
      'x-user-id': '11111111-1111-4111-8111-111111111111',
    })
  })
})
