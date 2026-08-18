import type { StudySession } from '../contracts/study-session'

export type SessionAction = 'pause' | 'resume' | 'complete'

export function getAvailableSessionActions(status: StudySession['status']): SessionAction[] {
  if (status === 'running') {
    return ['pause', 'complete']
  }
  if (status === 'paused') {
    return ['resume', 'complete']
  }
  return []
}

export function canPerformSessionAction(
  status: StudySession['status'],
  action: SessionAction,
): boolean {
  return getAvailableSessionActions(status).includes(action)
}
