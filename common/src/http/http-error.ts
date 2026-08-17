export type HttpErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN'

export interface SerializedHttpError {
  code: HttpErrorCode
  message: string
  status: number | null
  backendCode: string | null
  requestId: string | null
  details: unknown
}

export class HttpError extends Error {
  readonly serialized: SerializedHttpError

  constructor(error: SerializedHttpError, options?: ErrorOptions) {
    super(error.message, options)
    this.name = 'HttpError'
    this.serialized = error
  }

  get code(): HttpErrorCode {
    return this.serialized.code
  }
}

export function createHttpError(
  error: Omit<SerializedHttpError, 'status' | 'backendCode' | 'requestId' | 'details'> &
    Partial<SerializedHttpError>,
  options?: ErrorOptions,
): HttpError {
  return new HttpError(
    {
      code: error.code,
      message: error.message,
      status: error.status ?? null,
      backendCode: error.backendCode ?? null,
      requestId: error.requestId ?? null,
      details: error.details ?? null,
    },
    options,
  )
}

export function serializeHttpError(error: unknown): SerializedHttpError {
  if (error instanceof HttpError) {
    return error.serialized
  }
  return {
    code: 'UNKNOWN',
    message: '请求处理失败',
    status: null,
    backendCode: null,
    requestId: null,
    details: null,
  }
}

export function httpErrorFromStatus(status: number): HttpErrorCode {
  if (status === 401) {
    return 'UNAUTHORIZED'
  }
  if (status === 403) {
    return 'FORBIDDEN'
  }
  if (status === 404) {
    return 'NOT_FOUND'
  }
  if (status === 409) {
    return 'CONFLICT'
  }
  if (status === 429) {
    return 'RATE_LIMITED'
  }
  if (status >= 500) {
    return 'SERVER_ERROR'
  }
  return 'UNKNOWN'
}
