import { describe, expect, it } from 'vitest'
import { HttpError } from '../http'
import {
  existingSessionIdFromConflict,
  isUnknownCommandOutcome,
  sessionFromConflict,
  toUiError,
} from './ui-error'

describe('toUiError', () => {
  it('maps known http errors to user-facing copy', () => {
    const error = toUiError(
      new HttpError({
        code: 'NETWORK_ERROR',
        message: 'raw',
        status: null,
        backendCode: null,
        requestId: 'req-1',
        details: null,
      }),
    )
    expect(error).toMatchObject({
      code: 'NETWORK_ERROR',
      message: '当前网络不可用，暂时无法同步学习状态。请联网后再次操作。',
      requestId: 'req-1',
    })
  })

  it('reads conflict details without leaking unknown failures', () => {
    const conflict = toUiError(
      new HttpError({
        code: 'CONFLICT',
        message: '冲突',
        status: 409,
        backendCode: 'ACTIVE_STUDY_SESSION_EXISTS',
        requestId: null,
        details: { sessionId: '11111111-1111-4111-8111-111111111111' },
      }),
    )
    expect(existingSessionIdFromConflict(conflict)).toBe('11111111-1111-4111-8111-111111111111')
    expect(sessionFromConflict(conflict)).toBeNull()
    expect(isUnknownCommandOutcome({ ...conflict, code: 'TIMEOUT' })).toBe(true)
    expect(toUiError(new Error('secret token=abc')).message).toBe('服务暂时不可用')
    expect(
      toUiError(
        new HttpError({
          code: 'CONFIGURATION_ERROR',
          message: '缺少 EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN',
          status: null,
          backendCode: null,
          requestId: null,
          details: null,
        }),
      ).message,
    ).toBe('缺少 EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN')
  })
})
