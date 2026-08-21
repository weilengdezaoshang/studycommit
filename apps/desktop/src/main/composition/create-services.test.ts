// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '@studycommit/common/http'

vi.mock('electron', () => ({
  net: { fetch: vi.fn() },
}))

import { createDesktopServices, resolveDesktopServices } from './create-services'

describe('createDesktopServices', () => {
  it('maps missing origin to CONFIGURATION_ERROR', () => {
    expect(() => createDesktopServices({ NODE_ENV: 'development' })).toThrow(HttpError)
    try {
      createDesktopServices({ NODE_ENV: 'development' })
    } catch (error) {
      expect(error).toMatchObject({ serialized: { code: 'CONFIGURATION_ERROR' } })
    }
  })

  it('still exposes session handlers when configuration is missing', async () => {
    const services = resolveDesktopServices({ NODE_ENV: 'development' })
    await expect(services.studySessions.getActive()).rejects.toMatchObject({
      serialized: { code: 'CONFIGURATION_ERROR' },
    })
    await expect(
      services.learningLogs.getBySession('11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({
      serialized: { code: 'CONFIGURATION_ERROR' },
    })
  })
})
