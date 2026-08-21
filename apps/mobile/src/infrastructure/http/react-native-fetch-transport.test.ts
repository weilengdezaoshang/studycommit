import { studySessionSchema } from '@studycommit/common/contracts'
import { runningStudySessionFixture } from '@studycommit/common/contracts'
import { createMobileServices } from './create-mobile-services'
import { ReactNativeFetchTransport } from './react-native-fetch-transport'

describe('ReactNativeFetchTransport', () => {
  const originalOrigin = process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN

  afterEach(() => {
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN = originalOrigin
  })

  it('keeps the API prefix and injects development headers', async () => {
    const fetchImpl = jest.fn(async (input, init) => {
      expect(String(input)).toBe(
        `http://10.0.2.2:3000/api/study-sessions/${runningStudySessionFixture.id}`,
      )
      expect(init?.headers).toMatchObject({ 'x-user-id': '11111111-1111-4111-8111-111111111111' })
      return new Response(JSON.stringify(runningStudySessionFixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const transport = new ReactNativeFetchTransport({
      origin: 'http://10.0.2.2:3000',
      apiPrefix: '/api',
      fetchImpl,
      allowInsecureHttp: true,
      defaultTimeoutMs: 1000,
      getHeaders: async () => ({
        accept: 'application/json',
        'x-user-id': '11111111-1111-4111-8111-111111111111',
      }),
    })
    await transport.request({
      method: 'GET',
      path: `/study-sessions/${runningStudySessionFixture.id}`,
      responseSchema: studySessionSchema,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('assembles a study session client at the infrastructure root', () => {
    process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN = 'http://10.0.2.2:3000'
    const services = createMobileServices({ fetchImpl: jest.fn() })
    expect(services.studySessions.create).toEqual(expect.any(Function))
    expect(services.studySessions.getActive).toEqual(expect.any(Function))
    expect(services.learningLogs.getBySession).toEqual(expect.any(Function))
    expect(services.learningLogs.update).toEqual(expect.any(Function))
  })
})
