import { describe, expect, it } from 'vitest'
import { canPerformSessionAction, getAvailableSessionActions } from './session-actions'

describe('session actions', () => {
  it('allows pause and complete while running', () => {
    expect(getAvailableSessionActions('running')).toEqual(['pause', 'complete'])
    expect(canPerformSessionAction('running', 'resume')).toBe(false)
  })

  it('allows resume and complete while paused', () => {
    expect(getAvailableSessionActions('paused')).toEqual(['resume', 'complete'])
    expect(canPerformSessionAction('paused', 'pause')).toBe(false)
  })

  it('forbids mutating a completed session', () => {
    expect(getAvailableSessionActions('completed')).toEqual([])
    expect(canPerformSessionAction('completed', 'complete')).toBe(false)
  })
})
