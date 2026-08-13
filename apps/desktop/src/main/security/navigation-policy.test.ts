// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl } from './navigation-policy'

describe('external navigation policy', () => {
  it('allows valid HTTPS URLs', () => {
    expect(isAllowedExternalUrl('https://www.electronjs.org/docs/latest/')).toBe(true)
  })

  it.each([
    'http://example.com',
    'file:///tmp/example',
    'javascript:alert(1)',
    'studycommit://topics/1',
    'not a url'
  ])('rejects %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false)
  })
})
