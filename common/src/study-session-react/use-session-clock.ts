import { useEffect, useState } from 'react'
import type { StudySession } from '../contracts/study-session'
import {
  calculateElapsedSeconds,
  estimateServerNowMs,
  formatElapsedClock,
} from '../study-session-runtime'

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
    const timer = setInterval(() => {
      setTick({
        key: clockKey,
        offsetMs: performance.now() - originMs,
      })
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [clockKey, sessionId, sessionStatus, serverNow])

  if (!session || !serverNow) {
    return '00:00:00'
  }
  const offsetMs = tick.key === clockKey ? tick.offsetMs : 0
  const estimatedServerNowMs = estimateServerNowMs(serverNow, 0, offsetMs)
  return formatElapsedClock(calculateElapsedSeconds({ session, estimatedServerNowMs }))
}
