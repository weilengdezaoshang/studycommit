import { describe, expect, it } from 'vitest'
import { activeTopicFixture } from '../contracts/topic'
import { initialStartStudyState, startStudyReducer } from './start-study.reducer'
import type { UiError } from './ui-error'

const networkError: UiError = {
  code: 'NETWORK_ERROR',
  backendCode: null,
  message: '网络不可用',
  requestId: null,
  details: null,
}

describe('startStudyReducer', () => {
  it('keeps form topics when submit fails with an unknown outcome', () => {
    const ready = startStudyReducer(initialStartStudyState, {
      type: 'topics-succeeded',
      topics: [activeTopicFixture],
    })
    const submitting = startStudyReducer(ready, {
      type: 'submit-started',
      idempotencyKey: 'create-1',
    })
    const failed = startStudyReducer(submitting, { type: 'submit-failed', error: networkError })
    expect(failed).toEqual({
      status: 'error',
      topics: [activeTopicFixture],
      error: networkError,
      idempotencyKey: 'create-1',
    })
  })

  it('treats an empty topic list as a dedicated state', () => {
    expect(
      startStudyReducer(initialStartStudyState, { type: 'topics-succeeded', topics: [] }),
    ).toEqual({ status: 'empty-topics' })
  })
})
