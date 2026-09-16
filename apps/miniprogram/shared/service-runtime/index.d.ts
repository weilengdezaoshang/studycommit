/**
 * 小程序统一服务调用运行层（无平台依赖）：
 * 统一错误模型、云函数请求信封校验与客户端能力开关类型。
 * 页面只允许根据这里的错误码与能力开关分支，不得感知 HTTP 状态码或腾讯云原始错误。
 */
export type MiniprogramBackendMode = 'cloud-function' | 'http';
export type ServiceErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED' | 'PAYLOAD_TOO_LARGE' | 'TIMEOUT' | 'SERVICE_DISABLED' | 'PROVIDER_FAILED' | 'NETWORK_ERROR' | 'UNKNOWN';
export interface ServiceErrorInfo {
    code: ServiceErrorCode;
    message: string;
    retryable: boolean;
    details?: unknown;
}
/** 统一业务错误：页面按 code 分支展示文案，原始异常细节不出运行层。 */
export declare class ServiceError extends Error {
    readonly code: ServiceErrorCode;
    readonly retryable: boolean;
    readonly details?: unknown;
    constructor(info: ServiceErrorInfo);
}
export declare function isServiceError(error: unknown): error is ServiceError;
/** 非运行层异常统一兜底封装，保持原始 error 作为 cause。 */
export declare function toServiceError(error: unknown, fallback?: Partial<ServiceErrorInfo> & {
    code: ServiceErrorCode;
}): ServiceError;
/** 统一错误码对应的稳定用户文案；页面不得自行识别原始错误。 */
export declare const serviceErrorUserMessages: Record<ServiceErrorCode, string>;
export declare function serviceUserMessage(error: unknown): string;
/** 云函数统一请求信封。 */
export declare const CLOUD_FUNCTION_REQUEST_VERSION = 1;
export interface CloudFunctionRequest {
    version: typeof CLOUD_FUNCTION_REQUEST_VERSION;
    operation: string;
    requestId: string;
    idempotencyKey?: string;
    payload: unknown;
}
export interface CloudFunctionSuccess<TData = unknown> {
    ok: true;
    requestId: string;
    data: TData;
}
/** 线上失败信封：code 是未校验的字符串，转换时才收敛为 ServiceErrorCode。 */
export interface CloudFunctionErrorWire {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
}
export interface CloudFunctionFailure {
    ok: false;
    requestId: string;
    error: CloudFunctionErrorWire;
}
export type CloudFunctionResponse<TData = unknown> = CloudFunctionSuccess<TData> | CloudFunctionFailure;
/** 客户端必须校验响应结构；非法结构一律按供应商失败处理。 */
export declare function isCloudFunctionSuccess<TData = unknown>(response: unknown): response is CloudFunctionSuccess<TData>;
export declare function isCloudFunctionFailure(response: unknown): response is CloudFunctionFailure;
/** 信封失败 → ServiceError；未知错误码归为 UNKNOWN 且不透出原始消息细节。 */
export declare function serviceErrorFromCloudFailure(failure: CloudFunctionFailure): ServiceError;
/** HTTP 状态 → 统一错误码（HttpTransport 复用）。 */
export declare function serviceErrorCodeFromHttpStatus(status: number): ServiceErrorCode;
/** 服务端能力开关：服务端取值为最终决定权，本地配置只控制入口展示。 */
export interface ClientCapabilities {
    backendMode: MiniprogramBackendMode;
    captureEnabled: boolean;
    imageRecordEnabled: boolean;
    ocrEnabled: boolean;
    maxCaptureImages: number;
    maxImageBytes: number;
}
export declare const DEFAULT_MAX_CAPTURE_IMAGES = 9;
export declare const DEFAULT_MAX_IMAGE_BYTES: number;
export declare function defaultClientCapabilities(backendMode: MiniprogramBackendMode): ClientCapabilities;
/** 云端能力响应合并：只接受合法字段，服务端有最终决定权。 */
export declare function mergeClientCapabilities(base: ClientCapabilities, patch: unknown): ClientCapabilities;
