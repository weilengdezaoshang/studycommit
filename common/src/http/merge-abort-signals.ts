export function mergeAbortSignals(
  userSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; didTimeout: () => boolean; cleanup: () => void } {
  const controller = new AbortController()
  let timedOut = false
  const onUserAbort = () => {
    controller.abort(userSignal?.reason)
  }

  if (userSignal?.aborted) {
    controller.abort(userSignal.reason)
  } else {
    userSignal?.addEventListener('abort', onUserAbort, { once: true })
  }

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer)
      userSignal?.removeEventListener('abort', onUserAbort)
    },
  }
}
