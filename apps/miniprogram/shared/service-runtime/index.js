"use strict";
/**
 * 小程序统一服务调用运行层（无平台依赖）：
 * 统一错误模型、云函数请求信封校验与客户端能力开关类型。
 * 页面只允许根据这里的错误码与能力开关分支，不得感知 HTTP 状态码或腾讯云原始错误。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAX_IMAGE_BYTES = exports.DEFAULT_MAX_CAPTURE_IMAGES = exports.CLOUD_FUNCTION_REQUEST_VERSION = exports.serviceErrorUserMessages = exports.ServiceError = void 0;
exports.isServiceError = isServiceError;
exports.toServiceError = toServiceError;
exports.serviceUserMessage = serviceUserMessage;
exports.isCloudFunctionSuccess = isCloudFunctionSuccess;
exports.isCloudFunctionFailure = isCloudFunctionFailure;
exports.serviceErrorFromCloudFailure = serviceErrorFromCloudFailure;
exports.serviceErrorCodeFromHttpStatus = serviceErrorCodeFromHttpStatus;
exports.defaultClientCapabilities = defaultClientCapabilities;
exports.mergeClientCapabilities = mergeClientCapabilities;
/** 统一业务错误：页面按 code 分支展示文案，原始异常细节不出运行层。 */
class ServiceError extends Error {
    constructor(info) {
        super(info.message);
        this.name = 'ServiceError';
        this.code = info.code;
        this.retryable = info.retryable;
        this.details = info.details;
    }
}
exports.ServiceError = ServiceError;
function isServiceError(error) {
    return error instanceof ServiceError;
}
/** 非运行层异常统一兜底封装，保持原始 error 作为 cause。 */
function toServiceError(error, fallback = { code: 'UNKNOWN' }) {
    if (isServiceError(error)) {
        return error;
    }
    const message = error instanceof Error ? error.message : String(error ?? '');
    return new ServiceError({
        code: fallback.code,
        message: fallback.message || message || '服务调用失败',
        retryable: fallback.retryable ?? false,
        details: fallback.details,
    });
}
/** 统一错误码对应的稳定用户文案；页面不得自行识别原始错误。 */
exports.serviceErrorUserMessages = {
    UNAUTHENTICATED: '登录已失效，请重新进入小程序',
    FORBIDDEN: '没有权限执行该操作',
    INVALID_INPUT: '提交的内容不完整或有误',
    NOT_FOUND: '内容不存在或已被删除',
    CONFLICT: '内容已被修改，请刷新后重试',
    RATE_LIMITED: '操作太频繁，请稍后再试',
    PAYLOAD_TOO_LARGE: '文件过大，请压缩后重试',
    TIMEOUT: '请求超时，请稍后重试',
    SERVICE_DISABLED: '该功能暂时关闭',
    PROVIDER_FAILED: '服务暂时不可用，请稍后重试',
    NETWORK_ERROR: '网络不可用，请检查网络后重试',
    UNKNOWN: '操作失败，请重试',
};
function serviceUserMessage(error) {
    return isServiceError(error)
        ? exports.serviceErrorUserMessages[error.code]
        : exports.serviceErrorUserMessages.UNKNOWN;
}
/** 云函数统一请求信封。 */
exports.CLOUD_FUNCTION_REQUEST_VERSION = 1;
/** 客户端必须校验响应结构；非法结构一律按供应商失败处理。 */
function isCloudFunctionSuccess(response) {
    if (!response || typeof response !== 'object') {
        return false;
    }
    const value = response;
    return (value.ok === true &&
        typeof value.requestId === 'string' &&
        value.requestId.length > 0 &&
        'data' in value);
}
function isCloudFunctionFailure(response) {
    if (!response || typeof response !== 'object') {
        return false;
    }
    const value = response;
    const error = value.error;
    return (value.ok === false &&
        typeof value.requestId === 'string' &&
        value.requestId.length > 0 &&
        !!error &&
        typeof error.code === 'string' &&
        typeof error.message === 'string' &&
        typeof error.retryable === 'boolean');
}
function isServiceErrorCode(code) {
    return code in exports.serviceErrorUserMessages;
}
/** 信封失败 → ServiceError；未知错误码归为 UNKNOWN 且不透出原始消息细节。 */
function serviceErrorFromCloudFailure(failure) {
    const rawCode = failure.error.code;
    const known = isServiceErrorCode(rawCode);
    const code = known ? rawCode : 'UNKNOWN';
    return new ServiceError({
        code,
        message: known && failure.error.message ? failure.error.message : exports.serviceErrorUserMessages[code],
        retryable: failure.error.retryable,
        details: failure.error.details,
    });
}
/** HTTP 状态 → 统一错误码（HttpTransport 复用）。 */
function serviceErrorCodeFromHttpStatus(status) {
    if (status === 401 || status === 403) {
        return status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN';
    }
    if (status === 404) {
        return 'NOT_FOUND';
    }
    if (status === 409) {
        return 'CONFLICT';
    }
    if (status === 413) {
        return 'PAYLOAD_TOO_LARGE';
    }
    if (status === 429) {
        return 'RATE_LIMITED';
    }
    if (status >= 500) {
        return 'PROVIDER_FAILED';
    }
    return 'UNKNOWN';
}
exports.DEFAULT_MAX_CAPTURE_IMAGES = 9;
exports.DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
function defaultClientCapabilities(backendMode) {
    return {
        backendMode,
        captureEnabled: true,
        imageRecordEnabled: true,
        ocrEnabled: backendMode === 'cloud-function',
        maxCaptureImages: exports.DEFAULT_MAX_CAPTURE_IMAGES,
        maxImageBytes: exports.DEFAULT_MAX_IMAGE_BYTES,
    };
}
/** 云端能力响应合并：只接受合法字段，服务端有最终决定权。 */
function mergeClientCapabilities(base, patch) {
    if (!patch || typeof patch !== 'object') {
        return base;
    }
    const value = patch;
    const bool = (key, current) => typeof value[key] === 'boolean' ? value[key] : current;
    const capped = (current, min, max) => Number.isFinite(current) ? Math.min(Math.max(Math.round(current), min), max) : min;
    const maxCaptureImages = typeof value.maxCaptureImages === 'number' ? value.maxCaptureImages : exports.DEFAULT_MAX_CAPTURE_IMAGES;
    const maxImageBytes = typeof value.maxImageBytes === 'number' ? value.maxImageBytes : exports.DEFAULT_MAX_IMAGE_BYTES;
    const backendMode = value.backendMode;
    return {
        backendMode: backendMode === 'cloud-function' || backendMode === 'http' ? backendMode : base.backendMode,
        captureEnabled: bool('captureEnabled', base.captureEnabled),
        imageRecordEnabled: bool('imageRecordEnabled', base.imageRecordEnabled),
        ocrEnabled: bool('ocrEnabled', base.ocrEnabled),
        maxCaptureImages: capped(maxCaptureImages, 1, exports.DEFAULT_MAX_CAPTURE_IMAGES),
        maxImageBytes: capped(maxImageBytes, 1, Number.MAX_SAFE_INTEGER),
    };
}
