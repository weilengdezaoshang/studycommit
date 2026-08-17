// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  net: { fetch: vi.fn() },
}))
import { studySessionSchema } from '@studycommit/common/contracts'
import { runningStudySessionFixture } from '@studycommit/common/contracts'
import { ElectronNetTransport } from './electron-net-transport'

describe('ElectronNetTransport', () => {
  it('uses the injected fetch implementation and keeps the API prefix', async () => {
    const fetchImpl = vi.fn(async (input) => {
      expect(String(input)).toBe(
        `http://localhost:3000/api/study-sessions/${runningStudySessionFixture.id}`,
      )
      return new Response(JSON.stringify(runningStudySessionFixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const transport = new ElectronNetTransport({
      origin: 'http://localhost:3000',
      apiPrefix: '/api',
      fetchImpl,
      getHeaders: async () => ({}),
      defaultTimeoutMs: 1000,
      allowInsecureHttp: true,
    })
    await transport.request({
      method: 'GET',
      path: `/study-sessions/${runningStudySessionFixture.id}`,
      responseSchema: studySessionSchema,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
