import { HttpError } from '@studycommit/common/http'
import { createMobileServices, resolveMobileServices } from './create-mobile-services'

describe('createMobileServices', () => {
  const originalOrigin = process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN

  afterEach(() => {
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN = originalOrigin
  })

  it('maps missing origin to CONFIGURATION_ERROR', () => {
    delete process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
    expect(() => createMobileServices()).toThrow(HttpError)
  })

  it('still exposes session and topic handlers when configuration is missing', async () => {
    delete process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN
    const services = resolveMobileServices()
    await expect(services.studySessions.getActive()).rejects.toMatchObject({
      serialized: { code: 'CONFIGURATION_ERROR' },
    })
    await expect(services.topics.listActive()).rejects.toMatchObject({
      serialized: { code: 'CONFIGURATION_ERROR' },
    })
    await expect(
      services.learningLogs.getBySession('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({
      serialized: { code: 'CONFIGURATION_ERROR' },
    })
  })
})
