import {
  isServiceError,
  serviceErrorUserMessages,
  type ServiceErrorCode,
} from '../../shared/service-runtime/index'

/** 采集页统一错误文案：ServiceErrorCode + 兼容历史 OCR 错误码。 */
const OCR_CODE_MESSAGES: Record<string, string> = {
  OCR_UNAUTHENTICATED: '登录已失效，请重新登录后识别',
  OCR_IMAGE_TOO_LARGE: '图片过大，请裁剪后重试',
  OCR_RATE_LIMITED: '今日识别次数已用完，图片仍可直接保存',
  OCR_NOT_CONFIGURED: '识别服务暂未开放，图片仍可直接保存',
  OCR_DISABLED: '识别服务暂时关闭，图片仍可直接保存',
  OCR_TIMEOUT: '识别超时，请稍后重试',
  OCR_PROVIDER_FAILED: '识别服务暂时不可用，请稍后重试',
}

const SERVICE_CODE_CAPTURE_MESSAGES: Partial<Record<ServiceErrorCode, string>> = {
  UNAUTHENTICATED: '登录已失效，请重新登录后识别',
  PAYLOAD_TOO_LARGE: '图片过大，请裁剪后重试',
  RATE_LIMITED: '今日识别次数已用完，图片仍可直接保存',
  SERVICE_DISABLED: '识别服务暂未开放，图片仍可直接保存',
  TIMEOUT: '识别超时，请稍后重试',
  PROVIDER_FAILED: '识别服务暂时不可用，请稍后重试',
  FORBIDDEN: '无权识别该图片，请重新拍照',
}

const FALLBACK_MESSAGE = '识别失败，请重试或直接保存图片'

export function captureServiceErrorMessage(error: unknown): string {
  if (isServiceError(error)) {
    return SERVICE_CODE_CAPTURE_MESSAGES[error.code] ?? serviceErrorUserMessages[error.code]
  }
  const code = error instanceof Error ? error.message : String(error ?? '')
  return OCR_CODE_MESSAGES[code] ?? FALLBACK_MESSAGE
}
