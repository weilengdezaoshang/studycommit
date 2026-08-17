// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '@studycommit/common/http'

vi.mock('electron', () => ({
  net: { fetch: vi.fn() },
}))

import { createDesktopServices } from './create-services'

describe('createDesktopServices', () => {
  it('maps missing origin to CONFIGURATION_ERROR', () => {
    expect(() => createDesktopServices({ NODE_ENV: 'development' })).toThrow(HttpError)
    try {
      createDesktopServices({ NODE_ENV: 'development' })
    } catch (error) {
      expect(error).toMatchObject({ serialized: { code: 'CONFIGURATION_ERROR' } })
    }
  })
})
