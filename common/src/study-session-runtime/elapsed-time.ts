import type { StudySession } from '../contracts/study-session'

export interface ElapsedTimeInput {
  session: StudySession
  estimatedServerNowMs: number
}

export function estimateServerNowMs(
  serverNow: string,
  monotonicAtSyncMs: number,
  monotonicNowMs: number,
): number {
  return Date.parse(serverNow) + Math.max(0, monotonicNowMs - monotonicAtSyncMs)
}

export function calculateElapsedSeconds(input: ElapsedTimeInput): number {
  const { session, estimatedServerNowMs } = input
  if (session.status === 'completed') {
    return Math.max(0, session.durationSeconds ?? 0)
  }

  const startedAtMs = Date.parse(session.startedAt)
  const endMs =
    session.status === 'paused' && session.pausedAt
      ? Date.parse(session.pausedAt)
      : estimatedServerNowMs
  const rawSeconds = Math.floor((endMs - startedAtMs) / 1000) - session.totalPausedSeconds
  return Math.max(0, rawSeconds)
}

export const LONG_SESSION_THRESHOLD_SECONDS = 4 * 60 * 60

export function isLongSession(session: StudySession | null, serverNow: string | null): boolean {
  if (!session || !serverNow || session.status === 'completed') {
    return false
  }
  return (
    calculateElapsedSeconds({
      session,
      estimatedServerNowMs: Date.parse(serverNow),
    }) >= LONG_SESSION_THRESHOLD_SECONDS
  )
}

export function formatElapsedClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
