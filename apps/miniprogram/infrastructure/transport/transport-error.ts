import {
  ServiceError,
  serviceErrorCodeFromHttpStatus,
  toServiceError,
  type ServiceErrorCode,
} from '../../shared/service-runtime/index'
import type { HttpError } from '../../services/http'

/** HTTP 客户端错误码 → 统一错误码。 */
const HTTP_CODE_TO_SERVICE_CODE: Record<string, ServiceErrorCode> = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CANCELLED: 'UNKNOWN',
  UNAUTHORIZED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVER_ERROR: 'PROVIDER_FAILED',
  INVALID_RESPONSE: 'PROVIDER_FAILED',
  CONFIGURATION_ERROR: 'SERVICE_DISABLED',
  UNKNOWN: 'UNKNOWN',
}

export function serviceErrorFromHttpError(error: HttpError): ServiceError {
  const code = HTTP_CODE_TO_SERVICE_CODE[error.code] ?? 'UNKNOWN'
  return new ServiceError({
    code,
    message: error.message,
    retryable: code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'PROVIDER_FAILED',
    details: error.serialized.requestId ? { requestId: error.serialized.requestId } : undefined,
  })
}

/** HTTP 状态兜底映射（绕过 HttpError 的原始异常场景）。 */
export function serviceErrorFromHttpStatus(status: number): ServiceError {
  return new ServiceError({
    code: serviceErrorCodeFromHttpStatus(status),
    message: '请求失败',
    retryable: status >= 500,
  })
}

/** 任意异常收敛为 ServiceError。 */
export function ensureServiceError(
  error: unknown,
  fallbackCode: ServiceErrorCode = 'UNKNOWN',
): ServiceError {
  return toServiceError(error, { code: fallbackCode })
}

/** 读操作回退资格：仅网络层/服务端故障可回退，业务失败不回退。 */
export function isFallbackEligible(error: unknown): boolean {
  if (!(error instanceof ServiceError)) {
    return false
  }
  return (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'TIMEOUT' ||
    error.code === 'PROVIDER_FAILED' ||
    error.code === 'SERVICE_DISABLED'
  )
}
