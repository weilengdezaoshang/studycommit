"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureScenarios = exports.captureStatusLabels = exports.captureImageVersionKey = exports.emptyCaptureSaveAttempt = exports.CAPTURE_IMAGE_LIMIT = void 0;
exports.normalizeCaptureState = normalizeCaptureState;
exports.createCaptureState = createCaptureState;
exports.captureReducer = captureReducer;
exports.captureSummary = captureSummary;
exports.createCaptureScenario = createCaptureScenario;
exports.prepareCaptureSave = prepareCaptureSave;
exports.applyCaptureUploadCheckpoint = applyCaptureUploadCheckpoint;
exports.captureOcrErrorMessage = captureOcrErrorMessage;
exports.mergeRecognizedText = mergeRecognizedText;
exports.runCaptureRecognition = runCaptureRecognition;
/** 无平台依赖的图片页面模型；OCR、媒体及保存由宿主适配。 */
exports.CAPTURE_IMAGE_LIMIT = 9;
const emptyCaptureSaveAttempt = () => ({
    idempotencyKey: null,
    uploadsByImageVersion: {},
});
exports.emptyCaptureSaveAttempt = emptyCaptureSaveAttempt;
const captureImageVersionKey = (image) => `${image.id}@${image.version}`;
exports.captureImageVersionKey = captureImageVersionKey;
function invalidatePaperRequest(state) {
    return { ...state, saveAttempt: { ...state.saveAttempt, idempotencyKey: null } };
}
function recognizedContent(images) {
    return images
        .map((image) => image.text)
        .filter(Boolean)
        .join('\n\n');
}
/** 兼容旧草稿，并清除已不属于当前图片版本的上传会话。 */
function normalizeCaptureState(state) {
    const validKeys = new Set(state.images.map(exports.captureImageVersionKey));
    const uploadsByImageVersion = Object.fromEntries(Object.entries(state.saveAttempt?.uploadsByImageVersion ?? {}).filter(([key]) => validKeys.has(key)));
    return {
        ...state,
        activeRunId: null,
        saveCompleted: Number.isInteger(state.saveCompleted) ? state.saveCompleted : 0,
        saveAttempt: {
            idempotencyKey: state.saveAttempt?.idempotencyKey ?? null,
            uploadsByImageVersion,
        },
    };
}
function createCaptureState(mode = 'ocr') {
    return {
        mode,
        page: 'preview',
        images: [],
        selected: 0,
        content: '',
        edited: false,
        question: false,
        error: '',
        recovery: false,
        activeRunId: null,
        saveCompleted: 0,
        saveAttempt: (0, exports.emptyCaptureSaveAttempt)(),
    };
}
function captureReducer(state, action) {
    switch (action.type) {
        case 'restore':
            return { ...normalizeCaptureState(action.state), recovery: true };
        case 'page':
            return { ...state, page: action.page, error: '' };
        case 'add': {
            const images = [
                ...state.images,
                ...action.images.filter((i) => !state.images.some((s) => s.id === i.id)),
            ];
            if (images.length > exports.CAPTURE_IMAGE_LIMIT) {
                return { ...state, error: '最多添加 9 张图片' };
            }
            return invalidatePaperRequest({
                ...state,
                images,
                selected: Math.max(0, images.length - 1),
                error: '',
            });
        }
        case 'select':
            return { ...state, selected: Math.max(0, Math.min(action.index, state.images.length - 1)) };
        case 'media':
            return {
                ...state,
                images: state.images.map((image) => image.id === action.id
                    ? {
                        ...image,
                        uri: action.uri,
                        width: action.width ?? image.width,
                        height: action.height ?? image.height,
                    }
                    : image),
            };
        case 'remove': {
            const images = state.images.filter((i) => i.id !== action.id);
            return invalidatePaperRequest({
                ...state,
                images,
                content: state.edited || state.mode === 'image' ? state.content : recognizedContent(images),
                selected: Math.max(0, Math.min(state.selected, images.length - 1)),
                saveAttempt: normalizeCaptureState({ ...state, images }).saveAttempt,
            });
        }
        case 'move': {
            const images = [...state.images];
            const from = images.findIndex((i) => i.id === action.id);
            const to = from + action.delta;
            if (from < 0 || to < 0 || to >= images.length) {
                return state;
            }
            const selectedId = state.images[state.selected]?.id;
            [images[from], images[to]] = [images[to], images[from]];
            return invalidatePaperRequest({
                ...state,
                images,
                content: state.edited || state.mode === 'image' ? state.content : recognizedContent(images),
                selected: images.findIndex((i) => i.id === selectedId),
            });
        }
        case 'content':
            return invalidatePaperRequest({ ...state, content: action.content, edited: true });
        case 'question':
            return invalidatePaperRequest({ ...state, question: !state.question });
        case 'error':
            return { ...state, error: action.message };
        case 'run':
            return {
                ...state,
                activeRunId: action.runId,
                error: '',
                images: state.images.map((image) => action.ids.includes(image.id) ? { ...image, status: 'waiting' } : image),
            };
        case 'cancel-run':
            if (state.activeRunId !== action.runId) {
                return state;
            }
            return {
                ...state,
                activeRunId: null,
                images: state.images.map((image) => image.status === 'working' ? { ...image, status: 'waiting' } : image),
            };
        case 'result':
            return {
                ...state,
                images: state.images.map((i) => i.id === action.id &&
                    (action.version === undefined || i.version === action.version) &&
                    (action.runId === undefined || state.activeRunId === action.runId)
                    ? { ...i, status: action.status, text: action.text ?? i.text }
                    : i),
            };
        case 'crop': {
            const images = state.images.map((image) => image.id === action.id
                ? {
                    ...image,
                    uri: action.uri,
                    width: action.width,
                    height: action.height,
                    sizeBytes: action.sizeBytes,
                    mimeType: action.mimeType ?? image.mimeType,
                    version: image.version + 1,
                    status: 'waiting',
                    text: '',
                    uploadId: undefined,
                    missing: false,
                }
                : image);
            return invalidatePaperRequest({
                ...state,
                images,
                content: state.edited || state.mode === 'image' ? state.content : recognizedContent(images),
                saveAttempt: normalizeCaptureState({ ...state, images }).saveAttempt,
            });
        }
        case 'save-progress':
            return { ...state, saveCompleted: action.completed };
        case 'begin-save':
            return {
                ...state,
                saveCompleted: 0,
                saveAttempt: { ...state.saveAttempt, idempotencyKey: action.idempotencyKey },
            };
        case 'reserve-upload':
            return {
                ...state,
                saveAttempt: {
                    ...state.saveAttempt,
                    uploadsByImageVersion: {
                        ...state.saveAttempt.uploadsByImageVersion,
                        [`${action.id}@${action.version}`]: action.uploadId,
                    },
                },
            };
        case 'edit':
            return {
                ...state,
                page: 'editor',
                content: state.edited || state.mode === 'image' ? state.content : recognizedContent(state.images),
            };
        case 'recover':
            return action.keep ? { ...state, recovery: false } : createCaptureState(state.mode);
    }
}
exports.captureStatusLabels = {
    waiting: '等待识别',
    working: '识别中…',
    done: '已完成',
    failed: '识别失败',
    empty: '未检测到文字',
};
function captureSummary(state) {
    const done = state.images.filter((i) => i.status === 'done').length;
    const failed = state.images.filter((i) => i.status === 'failed').length;
    const working = state.images.some((i) => i.status === 'working' || i.status === 'waiting');
    return {
        done,
        failed,
        working,
        canSave: Boolean((state.content.trim() || state.images.length) &&
            !state.images.some((i) => i.missing) &&
            state.content.length <= 20000),
        title: working
            ? '把图片变成文字'
            : done
                ? failed
                    ? '有图片还没识别好'
                    : '识别完成'
                : failed
                    ? '暂时无法识别'
                    : '没有识别到文字',
    };
}
/** 仅供独立设计预览入口；正式采集流程不使用示例结果。 */
exports.captureScenarios = [
    ['preview', '多图预览'],
    ['image', '纯图片编辑'],
    ['sort', '调整顺序'],
    ['limit', '9 张上限'],
    ['working', '识别中'],
    ['partial', '部分失败'],
    ['failed', '全部失败'],
    ['empty', '没有文字'],
    ['result', '结果编辑'],
    ['saving', '保存进度'],
    ['save-error', '保存失败'],
    ['recovery', '草稿恢复'],
    ['permission', '相机权限'],
    ['missing', '图片缺失'],
    ['list', '图片记录卡片'],
    ['detail', '记录详情'],
    ['viewer', '全屏查看'],
];
function createCaptureScenario(name, uris) {
    const state = createCaptureState(['image', 'limit', 'list', 'detail'].includes(name) ? 'image' : 'ocr');
    state.images = Array.from({ length: name === 'limit' ? 9 : 3 }, (_, i) => ({
        id: `preview-${i}`,
        uri: uris[i % uris.length] ?? '',
        version: 1,
        status: 'done',
        text: [
            '合上书，用自己的话讲一遍。',
            '隔一段时间，再回想一次。',
            '想不起来的地方，就是下一次学习的起点。',
        ][i % 3],
    }));
    state.selected = name === 'limit' ? 8 : 1;
    state.content = ['image', 'list', 'detail'].includes(name)
        ? ''
        : state.images.map((i) => i.text).join('\n\n');
    if (['image', 'result', 'recovery', 'missing'].includes(name)) {
        state.page = 'editor';
    }
    if (name === 'sort' ||
        name === 'viewer' ||
        name === 'detail' ||
        name === 'permission' ||
        name === 'list') {
        state.page = name;
    }
    if (name === 'saving' || name === 'save-error') {
        state.page = 'saving';
        state.images[1].status = name === 'saving' ? 'working' : 'failed';
        state.images[2].status = 'waiting';
        state.error = name === 'save-error' ? '第 2 张图片上传失败，文字和图片已保留' : '';
    }
    if (['working', 'partial', 'failed', 'empty'].includes(name)) {
        state.page = 'recognition';
        state.images = state.images.map((i, n) => ({
            ...i,
            status: name === 'working'
                ? n === 0
                    ? 'done'
                    : n === 1
                        ? 'working'
                        : 'waiting'
                : name === 'partial'
                    ? n === 1
                        ? 'failed'
                        : 'done'
                    : name === 'failed'
                        ? 'failed'
                        : 'empty',
            text: name === 'empty' || name === 'failed' ? '' : i.text,
        }));
    }
    state.recovery = name === 'recovery';
    if (name === 'missing') {
        state.images[1] = { ...state.images[1], missing: true, uri: '' };
    }
    return state;
}
/** 为一次保存生成或复用稳定的幂等键。 */
function prepareCaptureSave(state, createId) {
    const idempotencyKey = state.saveAttempt.idempotencyKey ?? createId();
    const next = captureReducer(state, { type: 'begin-save', idempotencyKey });
    return {
        state: next,
        input: {
            content: next.content,
            images: next.images,
            question: Boolean(next.content.trim()) && next.question,
            idempotencyKey,
            uploadsByImageVersion: next.saveAttempt.uploadsByImageVersion,
        },
    };
}
function applyCaptureUploadCheckpoint(state, checkpoint) {
    return captureReducer(state, {
        type: 'reserve-upload',
        id: checkpoint.imageId,
        version: checkpoint.version,
        uploadId: checkpoint.uploadId,
    });
}
/** OCR 错误只向页面暴露稳定的用户文案。 */
function captureOcrErrorMessage(error) {
    const code = error instanceof Error ? error.message : String(error);
    const messages = {
        OCR_UNAUTHENTICATED: '登录已失效，请重新登录后识别',
        OCR_IMAGE_TOO_LARGE: '图片过大，请裁剪后重试',
        OCR_RATE_LIMITED: '今日识别次数已用完，图片仍可直接保存',
        OCR_NOT_CONFIGURED: '识别服务暂未开放，图片仍可直接保存',
        OCR_DISABLED: '识别服务暂时关闭，图片仍可直接保存',
        OCR_TIMEOUT: '识别超时，请稍后重试',
        OCR_PROVIDER_FAILED: '识别服务暂时不可用，请稍后重试',
    };
    return messages[code] ?? '识别失败，请重试或直接保存图片';
}
/** 用户编辑后不再自动改写正文。 */
function mergeRecognizedText(current, recognized, edited) {
    if (edited || !recognized.trim()) {
        return current;
    }
    return [current.trim(), recognized.trim()].filter(Boolean).join('\n\n');
}
/** 串行识别，失败项互不影响；取消后立即停止启动下一项。 */
async function runCaptureRecognition(images, port, runId, signal, emit) {
    for (const image of images) {
        if (signal.aborted) {
            return;
        }
        emit({ type: 'working', id: image.id, version: image.version, runId });
        try {
            const result = await port.recognize(image, signal);
            if (signal.aborted) {
                return;
            }
            emit({
                type: 'result',
                id: result.imageId,
                version: result.version,
                runId,
                status: result.text.trim() ? 'done' : 'empty',
                text: result.text,
            });
        }
        catch (error) {
            if (signal.aborted) {
                return;
            }
            emit({ type: 'failed', id: image.id, version: image.version, runId, error });
        }
    }
}
