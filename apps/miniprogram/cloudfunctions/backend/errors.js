/** backend 云函数错误模型：统一 ServiceErrorCode 与响应信封。 */

const SERVICE_CODES = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'TIMEOUT',
  'SERVICE_DISABLED',
  'PROVIDER_FAILED',
  'NETWORK_ERROR',
  'ACCOUNT_NOT_LINKED',
  'UNKNOWN',
])

const RETRYABLE_CODES = new Set(['TIMEOUT', 'PROVIDER_FAILED', 'NETWORK_ERROR'])

const FALLBACK_MESSAGE = '服务暂时不可用，请稍后重试'

const CODE_BY_STATUS = {
  400: 'INVALID_INPUT',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
}

function ok(requestId, data) {
  return { ok: true, requestId, data }
}

function fail(requestId, code, message, details) {
  const safeCode = SERVICE_CODES.has(code) ? code : 'UNKNOWN'
  return {
    ok: false,
    requestId,
    error: {
      code: safeCode === 'ACCOUNT_NOT_LINKED' ? 'UNAUTHENTICATED' : safeCode,
      message: message || FALLBACK_MESSAGE,
      retryable: RETRYABLE_CODES.has(safeCode),
      ...(details === undefined ? {} : { details }),
    },
  }
}

class BackendError extends Error {
  constructor(code, message, details) {
    super(message || FALLBACK_MESSAGE)
    this.name = 'BackendError'
    // 跨模块实例（CJS/ESM 互操作）下 instanceof 不可靠，用标记位识别。
    this.isBackendError = true
    this.code = code
    this.details = details
  }
}

function isBackendError(error) {
  return Boolean(error && typeof error === 'object' && error.isBackendError === true)
}

/** 内部 API 错误 → 统一错误码；优先采用 API 错误体里的稳定 code。 */
const API_CODE_TO_SERVICE_CODE = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  AUTH_ACCOUNT_DISABLED: 'UNAUTHENTICATED',
  AUTH_WECHAT_CODE_INVALID: 'UNAUTHENTICATED',
  AUTH_INVALID_CREDENTIALS: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_ERROR: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  UPLOAD_NOT_FOUND: 'NOT_FOUND',
  PAPER_NOT_FOUND: 'NOT_FOUND',
  TOPIC_NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UPLOAD_CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  UPLOAD_STORAGE_UNAVAILABLE: 'PROVIDER_FAILED',
  UPLOAD_UNAVAILABLE: 'NOT_FOUND',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
}

function serviceErrorFromApiStatus(status, body) {
  const error = body && typeof body === 'object' && body.error ? body.error : {}
  const apiCode = typeof error.code === 'string' ? error.code : ''
  const code =
    API_CODE_TO_SERVICE_CODE[apiCode] ||
    CODE_BY_STATUS[status] ||
    (status >= 500 ? 'PROVIDER_FAILED' : 'UNKNOWN')
  // API 的用户文案已经过脱敏，可直接透传；无文案时用兜底。
  const message =
    typeof error.message === 'string' && error.message ? error.message : FALLBACK_MESSAGE
  return new BackendError(code, message)
}

module.exports = {
  SERVICE_CODES,
  ok,
  fail,
  BackendError,
  isBackendError,
  serviceErrorFromApiStatus,
  FALLBACK_MESSAGE,
}
