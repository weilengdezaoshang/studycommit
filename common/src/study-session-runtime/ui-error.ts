import { HttpError } from '../http'

export interface UiError {
  code: string
  backendCode: string | null
  message: string
  requestId: string | null
  details: unknown
}

export function toUiError(error: unknown): UiError {
  if (error instanceof HttpError) {
    return {
      code: error.code,
      backendCode: error.serialized.backendCode,
      message: userMessageFor(error),
      requestId: error.serialized.requestId,
      details: error.serialized.details,
    }
  }
  return {
    code: 'UNKNOWN',
    backendCode: null,
    message: '服务暂时不可用',
    requestId: null,
    details: null,
  }
}

export function isUnknownCommandOutcome(error: UiError): boolean {
  return error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR'
}

export function existingSessionIdFromConflict(error: UiError): string | null {
  if (error.backendCode !== 'ACTIVE_STUDY_SESSION_EXISTS' || !error.details) {
    return null
  }
  if (typeof error.details !== 'object') {
    return null
  }
  const sessionId = (error.details as { sessionId?: unknown }).sessionId
  return typeof sessionId === 'string' ? sessionId : null
}

export function sessionFromConflict(error: UiError) {
  if (error.backendCode !== 'SESSION_VERSION_CONFLICT' || !error.details) {
    return null
  }
  if (typeof error.details !== 'object') {
    return null
  }
  const session = (error.details as { session?: unknown }).session
  return session ?? null
}

export function learningLogFromConflict(error: UiError) {
  if (error.backendCode !== 'LEARNING_LOG_VERSION_CONFLICT' || !error.details) {
    return null
  }
  if (typeof error.details !== 'object') {
    return null
  }
  const learningLog = (error.details as { learningLog?: unknown }).learningLog
  return learningLog ?? null
}

function userMessageFor(error: HttpError): string {
  if (error.code === 'NETWORK_ERROR') {
    return '当前网络不可用，暂时无法同步学习状态。请联网后再次操作。'
  }
  if (error.code === 'TIMEOUT') {
    return '请求超时，正在确认服务端状态。'
  }
  if (error.code === 'UNAUTHORIZED') {
    return '登录状态失效，请检查开发身份配置。'
  }
  if (error.serialized.backendCode === 'SESSION_VERSION_CONFLICT') {
    return '会话已在其他位置更新。'
  }
  if (error.serialized.backendCode === 'ACTIVE_STUDY_SESSION_EXISTS') {
    return '当前已有进行中的学习会话。'
  }
  if (error.serialized.backendCode === 'LEARNING_LOG_NOT_FOUND') {
    return '学习记录不存在'
  }
  if (error.serialized.backendCode === 'LEARNING_LOG_VERSION_CONFLICT') {
    return '学习记录已在其他位置更新。'
  }
  if (error.code === 'NOT_FOUND') {
    return '会话不存在或已无法访问。'
  }
  if (error.code === 'INVALID_RESPONSE') {
    return '服务返回了无法识别的数据。'
  }
  if (error.code === 'CONFIGURATION_ERROR') {
    return error.message || '应用请求配置不完整。'
  }
  if (error.code === 'SERVER_ERROR') {
    return '服务暂时不可用。'
  }
  return error.message
}
