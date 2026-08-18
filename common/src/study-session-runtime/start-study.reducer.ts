import type { Topic } from '../contracts/topic'
import type { UiError } from './ui-error'

export type StartStudyState =
  | { status: 'loading-topics' }
  | { status: 'ready'; topics: Topic[] }
  | { status: 'empty-topics' }
  | { status: 'submitting'; topics: Topic[]; idempotencyKey: string }
  | { status: 'error'; topics: Topic[]; error: UiError; idempotencyKey?: string }

export type StartStudyAction =
  | { type: 'topics-started' }
  | { type: 'topics-succeeded'; topics: Topic[] }
  | { type: 'topics-failed'; error: UiError }
  | { type: 'submit-started'; idempotencyKey: string }
  | { type: 'submit-failed'; error: UiError }

export const initialStartStudyState: StartStudyState = { status: 'loading-topics' }

export function startStudyReducer(
  state: StartStudyState,
  action: StartStudyAction,
): StartStudyState {
  switch (action.type) {
    case 'topics-started':
      return { status: 'loading-topics' }
    case 'topics-succeeded':
      return action.topics.length === 0
        ? { status: 'empty-topics' }
        : { status: 'ready', topics: action.topics }
    case 'topics-failed':
      if (action.error.code === 'CANCELLED') {
        return state
      }
      return { status: 'error', topics: [], error: action.error }
    case 'submit-started':
      if (state.status !== 'ready' && state.status !== 'error') {
        return state
      }
      return { status: 'submitting', topics: state.topics, idempotencyKey: action.idempotencyKey }
    case 'submit-failed':
      if (state.status !== 'submitting') {
        return state
      }
      return {
        status: 'error',
        topics: state.topics,
        error: action.error,
        idempotencyKey:
          action.error.code === 'TIMEOUT' || action.error.code === 'NETWORK_ERROR'
            ? state.idempotencyKey
            : undefined,
      }
    default:
      return state
  }
}
