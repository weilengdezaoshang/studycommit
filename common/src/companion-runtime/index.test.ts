import { describe, expect, it } from 'vitest'
import { transitionCompanion } from './index'

describe('companion runtime', () => {
  it('keeps companion state independent from session commands', () => {
    expect(transitionCompanion('hidden', 'start')).toBe('arriving')
    expect(transitionCompanion('writing', 'pause')).toBe('paused-idle')
    expect(transitionCompanion('paused-idle', 'resume')).toBe('writing')
    expect(transitionCompanion('waiting-wrapup', 'save-failed')).toBe('waiting-wrapup')
  })
})
