import { AdminApiError } from './api-client'

export type CommandResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'conflict'; error: AdminApiError }
  | { status: 'forbidden'; error: AdminApiError }
  | { status: 'unauthorized'; error: AdminApiError }
  | { status: 'rate_limited'; error: AdminApiError; retryAfterMs: number | null }
  | { status: 'unknown'; error: Error }
  | { status: 'failed'; error: AdminApiError }

export async function runCommand<T>(
  operation: () => Promise<T>,
  mode: 'read' | 'write' = 'write',
): Promise<CommandResult<T>> {
  try {
    const data = await operation()
    return { status: 'ok', data }
  } catch (caught) {
    if (caught instanceof AdminApiError) {
      if (caught.status === 409 || /VERSION_CONFLICT/i.test(caught.code)) {
        return { status: 'conflict', error: caught }
      }
      if (caught.status === 401) {
return { status: 'unauthorized', error: caught }
}
      if (caught.status === 403) {
return { status: 'forbidden', error: caught }
}
      if (caught.status === 429) {
        return { status: 'rate_limited', error: caught, retryAfterMs: caught.retryAfterMs }
      }
      if (caught.status >= 500 && mode === 'write') {
        return { status: 'unknown', error: caught }
      }
      return { status: 'failed', error: caught }
    }
    return {
      status: 'unknown',
      error: caught instanceof Error ? caught : new Error('网络异常'),
    }
  }
}

export function isUnknownWriteResult(result: CommandResult<unknown>): boolean {
  return result.status === 'unknown'
}
