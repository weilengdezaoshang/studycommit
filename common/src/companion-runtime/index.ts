export type CompanionState =
  'hidden' | 'arriving' | 'writing' | 'thinking' | 'paused-idle' | 'waiting-wrapup' | 'leaving'
export type CompanionEvent =
  'start' | 'pause' | 'resume' | 'quick-note' | 'complete' | 'saved' | 'save-failed' | 'hide'

const transitions: Record<CompanionState, Partial<Record<CompanionEvent, CompanionState>>> = {
  hidden: { start: 'arriving' },
  arriving: { start: 'writing', hide: 'hidden' },
  writing: {
    pause: 'paused-idle',
    'quick-note': 'writing',
    complete: 'waiting-wrapup',
    hide: 'hidden',
  },
  thinking: { resume: 'writing', pause: 'paused-idle' },
  'paused-idle': { resume: 'writing', hide: 'hidden' },
  'waiting-wrapup': { saved: 'leaving', 'save-failed': 'waiting-wrapup' },
  leaving: { hide: 'hidden' },
}

export function transitionCompanion(state: CompanionState, event: CompanionEvent): CompanionState {
  return transitions[state][event] ?? state
}
