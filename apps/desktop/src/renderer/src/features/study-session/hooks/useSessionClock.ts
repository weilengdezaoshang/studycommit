import { useEffect, useState } from 'react'
import type { StudySession } from '@studycommit/common/contracts'
import {
  calculateElapsedSeconds,
  estimateServerNowMs,
  formatElapsedClock,
} from '@studycommit/common/study-session-runtime'

export function useSessionClock(session: StudySession | null, serverNow: string | null): string {
  const sessionId = session?.id
  const sessionStatus = session?.status
  const clockKey = `${sessionId ?? ''}:${sessionStatus ?? ''}:${serverNow ?? ''}`
  const [tick, setTick] = useState({ key: '', offsetMs: 0 })

  useEffect(() => {
    if (!sessionId || sessionStatus !== 'running' || !serverNow) {
      return
    }
    const originMs = performance.now()
    const timer = window.setInterval(() => {
      setTick({
        key: clockKey,
        offsetMs: performance.now() - originMs,
      })
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [clockKey, sessionId, sessionStatus, serverNow])

  if (!session || !serverNow) {
    return '00:00:00'
  }
  const offsetMs = tick.key === clockKey ? tick.offsetMs : 0
  const estimatedServerNowMs = estimateServerNowMs(serverNow, 0, offsetMs)
  return formatElapsedClock(calculateElapsedSeconds({ session, estimatedServerNowMs }))
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
