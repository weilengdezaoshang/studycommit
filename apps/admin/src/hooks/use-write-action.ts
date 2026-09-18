import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminApiError } from '@/services/api-client'
import { runCommand, type CommandResult } from '@/services/command'

export type QueryOutcome = 'confirmed' | 'unresolved'

export interface ConflictInfo {
  currentVersion: number
  latestVersion: number | null
}

/**
 * 页面级写操作状态:409 锁提交、未知结果不因关窗丢失、429 倒计时内禁止重试.
 * 关闭弹窗不会清 unknown/conflict;未变化的 GET 不能当作写失败.
 */
export function useWriteAction(initialVersion?: number | null) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)
  const [unknown, setUnknown] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [reviewedLatest, setReviewedLatest] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const versionRef = useRef<number | null>(initialVersion ?? null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (open || conflict || unknown) {
return
}
    if (initialVersion !== undefined && initialVersion !== null) {
      versionRef.current = initialVersion
    }
  }, [conflict, initialVersion, open, unknown])

  useEffect(() => {
    if (!rateLimitedUntil) {
return
}
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [rateLimitedUntil])

  const remainingMs = rateLimitedUntil ? Math.max(0, rateLimitedUntil - now) : 0
  const rateLimited = remainingMs > 0

  const writesLocked = Boolean(unknown) || busy || rateLimited || accessDenied
  const canSubmit = !busy && !unknown && !conflict && !rateLimited && !accessDenied

  const openModal = useCallback(() => setOpen(true), [])
  const closeModal = useCallback(() => {
    if (busy) {
return
}
    setOpen(false)
  }, [busy])

  const resetAfterSuccess = useCallback(() => {
    setOpen(false)
    setBusy(false)
    setConflict(null)
    setUnknown(null)
    setFailed(null)
    setReviewedLatest(false)
  }, [])

  const markReviewedLatest = useCallback(() => {
    setReviewedLatest(true)
  }, [])

  const applyLatestVersion = useCallback((version: number) => {
    versionRef.current = version
    setConflict(null)
    setReviewedLatest(false)
  }, [])

  const expectedVersion = () => versionRef.current

  const run = useCallback(
    async <T>(operation: () => Promise<T>): Promise<CommandResult<T>> => {
      if (inFlightRef.current || unknown || conflict || rateLimited || accessDenied) {
        return {
          status: 'failed',
          error: new AdminApiError('WRITE_LOCKED', unknown ?? '当前不可提交', 409),
        }
      }
      inFlightRef.current = true
      setBusy(true)
      setFailed(null)
      const result = await runCommand(operation, 'write')
      if (result.status === 'ok') {
        inFlightRef.current = false
        resetAfterSuccess()
        return result
      }
      if (result.status === 'conflict') {
        setConflict({
          currentVersion: versionRef.current ?? 0,
          latestVersion: null,
        })
        setBusy(false)
        inFlightRef.current = false
        setOpen(true)
        return result
      }
      if (result.status === 'unknown') {
        setUnknown('操作结果待确认。请先查询原对象状态，不要重复提交。')
        setBusy(false)
        inFlightRef.current = false
        setOpen(true)
        return result
      }
      if (result.status === 'rate_limited') {
        const wait = result.retryAfterMs && result.retryAfterMs > 0 ? result.retryAfterMs : 30_000
        setRateLimitedUntil(Date.now() + wait)
        setBusy(false)
        inFlightRef.current = false
        setOpen(true)
        return result
      }
      if (result.status === 'forbidden' || result.status === 'unauthorized') {
setAccessDenied(true)
}
      setFailed(result.error.message)
      setBusy(false)
      inFlightRef.current = false
      return result
    },
    [accessDenied, conflict, rateLimited, resetAfterSuccess, unknown],
  )

  const noteConflictLatest = useCallback((latestVersion: number | null) => {
    setConflict((prev) => ({
      currentVersion: prev?.currentVersion ?? versionRef.current ?? 0,
      latestVersion,
    }))
  }, [])

  const queryUnknown = useCallback(
    async (
      query: () => Promise<QueryOutcome>,
      unresolvedMessage: string,
    ): Promise<QueryOutcome> => {
      setBusy(true)
      try {
        const outcome = await query()
        if (outcome === 'confirmed') {
          setUnknown(null)
          setOpen(false)
          return 'confirmed'
        }
        setUnknown(unresolvedMessage)
        setOpen(true)
        return 'unresolved'
      } catch (error) {
        setUnknown(
          error instanceof Error
            ? `查询失败：${error.message}。结果仍待确认，请稍后再查，不要重复提交。`
            : '查询失败，结果仍待确认，不要重复提交。',
        )
        setOpen(true)
        return 'unresolved'
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  return useMemo(
    () => ({
      open,
      busy,
      conflict,
      unknown,
      failed,
      rateLimited,
      remainingMs,
      reviewedLatest,
      writesLocked,
      canSubmit,
      openModal,
      closeModal,
      resetAfterSuccess,
      markReviewedLatest,
      applyLatestVersion,
      expectedVersion,
      run,
      noteConflictLatest,
      queryUnknown,
      setUnknown,
    }),
    [
      applyLatestVersion,
      busy,
      canSubmit,
      closeModal,
      conflict,
      failed,
      markReviewedLatest,
      noteConflictLatest,
      open,
      openModal,
      queryUnknown,
      rateLimited,
      remainingMs,
      resetAfterSuccess,
      reviewedLatest,
      run,
      unknown,
      writesLocked,
    ],
  )
}
