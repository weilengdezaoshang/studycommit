import { describe, expect, it } from 'vitest'
import { redactSensitive, summarizeErrorBody } from './redact-sensitive'

describe('redactSensitive', () => {
  it('redacts nested keys regardless of case', () => {
    expect(
      redactSensitive({
        Authorization: 'Bearer secret',
        nested: { 'X-User-Id': 'user-1', Token: 'abc' },
      }),
    ).toEqual({
      Authorization: '[redacted]',
      nested: { 'X-User-Id': '[redacted]', Token: '[redacted]' },
    })
  })

  it('does not keep HTML error bodies', () => {
    expect(summarizeErrorBody('<html>stack token=abc</html>')).toBe('[non-json body omitted]')
  })
})
