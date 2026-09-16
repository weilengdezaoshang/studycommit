/** OCR 云函数纯逻辑：配置解析、输入校验、凭据解析、结果合并与错误归一。 */

// SCF 同步事件上限为 6 MiB；为 JSON 包装和调用协议预留空间。
const MAX_OCR_BASE64_LENGTH = 4 * 1024 * 1024
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/
// 处理器内部抛出的协议内错误码；其余异常一律归为供应商失败。
const KNOWN_FAILURE_CODES = new Set([
  'OCR_RATE_LIMITED',
  'OCR_TIMEOUT',
  'OCR_FORBIDDEN',
  'OCR_IMAGE_TOO_LARGE',
])

function fail(code) {
  return { ok: false, code }
}

/** OCR_ENABLED 未显式配置为 true 时一律视为关闭，避免漏配导致静默放行。 */
function readCloudConfig(env) {
  const dailyLimit = Number.parseInt(env.OCR_DAILY_LIMIT, 10)
  const timeoutMs = Number.parseInt(env.OCR_TIMEOUT_MS, 10)
  return {
    enabled: env.OCR_ENABLED === 'true',
    dailyLimit: Number.isInteger(dailyLimit) && dailyLimit > 0 ? dailyLimit : 50,
    timeoutMs: Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000,
    region: env.TENCENT_OCR_REGION || 'ap-guangzhou',
  }
}

/** 优先使用显式配置的密钥；未配置时回退到云函数绑定角色注入的临时凭据。 */
function resolveCredential(env) {
  if (env.TENCENT_SECRET_ID && env.TENCENT_SECRET_KEY) {
    return { secretId: env.TENCENT_SECRET_ID, secretKey: env.TENCENT_SECRET_KEY }
  }
  if (env.TENCENTCLOUD_SECRETID && env.TENCENTCLOUD_SECRETKEY) {
    const credential = {
      secretId: env.TENCENTCLOUD_SECRETID,
      secretKey: env.TENCENTCLOUD_SECRETKEY,
    }
    if (env.TENCENTCLOUD_SESSIONTOKEN) {
      credential.token = env.TENCENTCLOUD_SESSIONTOKEN
    }
    return credential
  }
  return null
}

function validateOcrInput(event) {
  const imageId = typeof event.imageId === 'string' ? event.imageId : ''
  const version = Number(event.version)
  const imageBase64 = event.imageBase64
  const fileRef = event.fileRef
  if (!imageId || imageId.length > 128) {
    return { code: 'OCR_INVALID_INPUT' }
  }
  if (!Number.isInteger(version) || version < 1) {
    return { code: 'OCR_INVALID_INPUT' }
  }
  // 图片来源二选一：私有云存储临时文件（推荐）或内联 Base64（兼容）。
  if (fileRef !== undefined) {
    if (typeof fileRef !== 'string' || !fileRef.startsWith('ocr-temp/') || fileRef.length > 200) {
      return { code: 'OCR_INVALID_INPUT' }
    }
    return { imageId, version, fileRef }
  }
  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return { code: 'OCR_INVALID_INPUT' }
  }
  if (imageBase64.length > MAX_OCR_BASE64_LENGTH) {
    return { code: 'OCR_IMAGE_TOO_LARGE' }
  }
  if (imageBase64.length % 4 !== 0 || !BASE64_PATTERN.test(imageBase64)) {
    return { code: 'OCR_INVALID_INPUT' }
  }
  return { imageId, version, imageBase64 }
}

/** 按 TextDetections 顺序合并文字；无文字时返回空串，由客户端标记 empty。 */
function mergeOcrText(response) {
  const detections =
    response && Array.isArray(response.TextDetections) ? response.TextDetections : []
  return detections
    .map((item) => (item && typeof item.DetectedText === 'string' ? item.DetectedText : ''))
    .filter(Boolean)
    .join('\n')
}

/** 供应商原始异常、RequestId 等细节不透出，只返回协议内错误码。 */
function resolveFailureCode(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return KNOWN_FAILURE_CODES.has(message) ? message : 'OCR_PROVIDER_FAILED'
}

/** 限时等待供应商响应；超时后同步返回，底层请求交由云函数超时回收。 */
function withTimeout(promise, timeoutMs) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

module.exports = {
  MAX_OCR_BASE64_LENGTH,
  fail,
  readCloudConfig,
  resolveCredential,
  validateOcrInput,
  mergeOcrText,
  resolveFailureCode,
  withTimeout,
}
