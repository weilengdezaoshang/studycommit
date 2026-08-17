import { serializeHttpError, type SerializedHttpError } from '@studycommit/common/http'

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: SerializedHttpError }

export function ipcSuccess<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function ipcFailure(error: unknown): IpcResult<never> {
  return { ok: false, error: serializeHttpError(error) }
}
