/** 无平台依赖的图片页面模型；OCR、媒体及保存由宿主适配。 */
export declare const CAPTURE_IMAGE_LIMIT = 9;
export type CaptureMode = 'ocr' | 'image';
export type CapturePage = 'preview' | 'sort' | 'recognition' | 'editor' | 'viewer' | 'permission' | 'saving' | 'detail' | 'list';
export type ImageStatus = 'waiting' | 'working' | 'done' | 'failed' | 'empty';
export interface CaptureImage {
    id: string;
    uri: string;
    /** 每次重新裁剪递增；异步结果只允许写回相同版本。 */
    version: number;
    status: ImageStatus;
    text: string;
    width?: number;
    height?: number;
    mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
    sizeBytes?: number;
    uploadId?: string;
    missing?: boolean;
}
export interface CaptureState {
    mode: CaptureMode;
    page: CapturePage;
    images: CaptureImage[];
    selected: number;
    content: string;
    edited: boolean;
    question: boolean;
    error: string;
    recovery: boolean;
    activeRunId: string | null;
    saveCompleted: number;
    /** 保存失败或重启后继续复用同一次请求及已预留的上传会话。 */
    saveAttempt: CaptureSaveAttempt;
}
export interface CaptureSaveAttempt {
    idempotencyKey: string | null;
    uploadsByImageVersion: Record<string, string>;
}
export declare const emptyCaptureSaveAttempt: () => CaptureSaveAttempt;
export declare const captureImageVersionKey: (image: Pick<CaptureImage, "id" | "version">) => string;
/** 兼容旧草稿，并清除已不属于当前图片版本的上传会话。 */
export declare function normalizeCaptureState(state: CaptureState): CaptureState;
export declare function createCaptureState(mode?: CaptureMode): CaptureState;
export type CaptureAction = {
    type: 'restore';
    state: CaptureState;
} | {
    type: 'page';
    page: CapturePage;
} | {
    type: 'add';
    images: CaptureImage[];
} | {
    type: 'select';
    index: number;
} | {
    type: 'media';
    id: string;
    uri: string;
    width?: number;
    height?: number;
} | {
    type: 'remove';
    id: string;
} | {
    type: 'move';
    id: string;
    delta: number;
} | {
    type: 'content';
    content: string;
} | {
    type: 'question';
} | {
    type: 'error';
    message: string;
} | {
    type: 'run';
    runId: string;
    ids: string[];
} | {
    type: 'cancel-run';
    runId: string;
} | {
    type: 'result';
    id: string;
    version?: number;
    runId?: string;
    status: ImageStatus;
    text?: string;
} | {
    type: 'crop';
    id: string;
    uri: string;
    width: number;
    height: number;
    sizeBytes?: number;
    mimeType?: CaptureImage['mimeType'];
} | {
    type: 'save-progress';
    completed: number;
} | {
    type: 'begin-save';
    idempotencyKey: string;
} | {
    type: 'reserve-upload';
    id: string;
    version: number;
    uploadId: string;
} | {
    type: 'edit';
} | {
    type: 'recover';
    keep: boolean;
};
export declare function captureReducer(state: CaptureState, action: CaptureAction): CaptureState;
export declare const captureStatusLabels: Record<ImageStatus, string>;
export declare function captureSummary(state: CaptureState): {
    done: number;
    failed: number;
    working: boolean;
    canSave: boolean;
    title: string;
};
/** 仅供独立设计预览入口；正式采集流程不使用示例结果。 */
export declare const captureScenarios: readonly [readonly ["preview", "多图预览"], readonly ["image", "纯图片编辑"], readonly ["sort", "调整顺序"], readonly ["limit", "9 张上限"], readonly ["working", "识别中"], readonly ["partial", "部分失败"], readonly ["failed", "全部失败"], readonly ["empty", "没有文字"], readonly ["result", "结果编辑"], readonly ["saving", "保存进度"], readonly ["save-error", "保存失败"], readonly ["recovery", "草稿恢复"], readonly ["permission", "相机权限"], readonly ["missing", "图片缺失"], readonly ["list", "图片记录卡片"], readonly ["detail", "记录详情"], readonly ["viewer", "全屏查看"]];
export declare function createCaptureScenario(name: string, uris: string[]): CaptureState;
export interface CaptureMediaPort {
    persist(image: CaptureImage, accountId: string): Promise<CaptureImage>;
    remove(image: CaptureImage): Promise<void>;
}
export interface CaptureOcrResult {
    imageId: string;
    version: number;
    text: string;
}
export interface CaptureOcrPort {
    recognize(image: CaptureImage, signal?: AbortSignal): Promise<CaptureOcrResult>;
}
export interface CaptureDraftPort {
    load(accountId: string): Promise<CaptureState | null>;
    save(accountId: string, state: CaptureState): Promise<void>;
    clear(accountId: string): Promise<void>;
}
export interface CaptureSavePort {
    save(input: CaptureSaveInput, onProgress: (completed: number) => void, onUploadReserved: (checkpoint: CaptureUploadCheckpoint) => Promise<void>): Promise<{
        id: string;
    }>;
}
export interface CaptureSaveInput {
    content: string;
    images: CaptureImage[];
    question: boolean;
    idempotencyKey: string;
    uploadsByImageVersion: Record<string, string>;
}
export interface CaptureUploadCheckpoint {
    imageId: string;
    version: number;
    uploadId: string;
}
/** 为一次保存生成或复用稳定的幂等键。 */
export declare function prepareCaptureSave(state: CaptureState, createId: () => string): {
    state: CaptureState;
    input: CaptureSaveInput;
};
export declare function applyCaptureUploadCheckpoint(state: CaptureState, checkpoint: CaptureUploadCheckpoint): CaptureState;
/** OCR 错误只向页面暴露稳定的用户文案。 */
export declare function captureOcrErrorMessage(error: unknown): string;
/** 用户编辑后不再自动改写正文。 */
export declare function mergeRecognizedText(current: string, recognized: string, edited: boolean): string;
export type CaptureTaskEvent = {
    type: 'working';
    id: string;
    version: number;
    runId: string;
} | {
    type: 'result';
    id: string;
    version: number;
    runId: string;
    status: 'done' | 'empty';
    text: string;
} | {
    type: 'failed';
    id: string;
    version: number;
    runId: string;
    error: unknown;
};
/** 串行识别，失败项互不影响；取消后立即停止启动下一项。 */
export declare function runCaptureRecognition(images: CaptureImage[], port: CaptureOcrPort, runId: string, signal: AbortSignal, emit: (event: CaptureTaskEvent) => void): Promise<void>;
