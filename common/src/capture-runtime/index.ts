/** 无平台依赖的图片页面模型；OCR、媒体及保存由宿主适配。 */
export const CAPTURE_IMAGE_LIMIT = 9
export type CaptureMode = 'ocr' | 'image'
export type CapturePage =
  | 'preview'
  | 'sort'
  | 'recognition'
  | 'editor'
  | 'viewer'
  | 'permission'
  | 'saving'
  | 'detail'
  | 'list'
export type ImageStatus = 'waiting' | 'working' | 'done' | 'failed' | 'empty'
export interface CaptureImage {
  id: string
  uri: string
  /** 每次重新裁剪递增；异步结果只允许写回相同版本。 */
  version: number
  status: ImageStatus
  text: string
  width?: number
  height?: number
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp'
  sizeBytes?: number
  uploadId?: string
  missing?: boolean
}
export interface CaptureState {
  mode: CaptureMode
  page: CapturePage
  images: CaptureImage[]
  selected: number
  content: string
  edited: boolean
  question: boolean
  error: string
  recovery: boolean
  activeRunId: string | null
  saveCompleted: number
  /** 保存失败或重启后继续复用同一次请求及已预留的上传会话。 */
  saveAttempt: CaptureSaveAttempt
}
export interface CaptureSaveAttempt {
  idempotencyKey: string | null
  uploadsByImageVersion: Record<string, string>
}
export const emptyCaptureSaveAttempt = (): CaptureSaveAttempt => ({
  idempotencyKey: null,
  uploadsByImageVersion: {},
})
export const captureImageVersionKey = (image: Pick<CaptureImage, 'id' | 'version'>): string =>
  `${image.id}@${image.version}`

function invalidatePaperRequest(state: CaptureState): CaptureState {
  return { ...state, saveAttempt: { ...state.saveAttempt, idempotencyKey: null } }
}

function recognizedContent(images: CaptureImage[]): string {
  return images
    .map((image) => image.text)
    .filter(Boolean)
    .join('\n\n')
}

/** 兼容旧草稿，并清除已不属于当前图片版本的上传会话。 */
export function normalizeCaptureState(state: CaptureState): CaptureState {
  const validKeys = new Set(state.images.map(captureImageVersionKey))
  const uploadsByImageVersion = Object.fromEntries(
    Object.entries(state.saveAttempt?.uploadsByImageVersion ?? {}).filter(([key]) =>
      validKeys.has(key),
    ),
  )
  return {
    ...state,
    activeRunId: null,
    saveCompleted: Number.isInteger(state.saveCompleted) ? state.saveCompleted : 0,
    saveAttempt: {
      idempotencyKey: state.saveAttempt?.idempotencyKey ?? null,
      uploadsByImageVersion,
    },
  }
}
export function createCaptureState(mode: CaptureMode = 'ocr'): CaptureState {
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
    saveAttempt: emptyCaptureSaveAttempt(),
  }
}
export type CaptureAction =
  | { type: 'restore'; state: CaptureState }
  | { type: 'page'; page: CapturePage }
  | { type: 'add'; images: CaptureImage[] }
  | { type: 'select'; index: number }
  | { type: 'media'; id: string; uri: string; width?: number; height?: number }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; delta: number }
  | { type: 'content'; content: string }
  | { type: 'question' }
  | { type: 'error'; message: string }
  | { type: 'run'; runId: string; ids: string[] }
  | { type: 'cancel-run'; runId: string }
  | {
      type: 'result'
      id: string
      version?: number
      runId?: string
      status: ImageStatus
      text?: string
    }
  | {
      type: 'crop'
      id: string
      uri: string
      width: number
      height: number
      sizeBytes?: number
      mimeType?: CaptureImage['mimeType']
    }
  | { type: 'save-progress'; completed: number }
  | { type: 'begin-save'; idempotencyKey: string }
  | { type: 'reserve-upload'; id: string; version: number; uploadId: string }
  | { type: 'edit' }
  | { type: 'recover'; keep: boolean }
export function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case 'restore':
      return { ...normalizeCaptureState(action.state), recovery: true }
    case 'page':
      return { ...state, page: action.page, error: '' }
    case 'add': {
      const images = [
        ...state.images,
        ...action.images.filter((i) => !state.images.some((s) => s.id === i.id)),
      ]
      if (images.length > CAPTURE_IMAGE_LIMIT) {
        return { ...state, error: '最多添加 9 张图片' }
      }
      return invalidatePaperRequest({
        ...state,
        images,
        selected: Math.max(0, images.length - 1),
        error: '',
      })
    }
    case 'select':
      return { ...state, selected: Math.max(0, Math.min(action.index, state.images.length - 1)) }
    case 'media':
      return {
        ...state,
        images: state.images.map((image) =>
          image.id === action.id
            ? {
                ...image,
                uri: action.uri,
                width: action.width ?? image.width,
                height: action.height ?? image.height,
              }
            : image,
        ),
      }
    case 'remove': {
      const images = state.images.filter((i) => i.id !== action.id)
      return invalidatePaperRequest({
        ...state,
        images,
        content: state.content,
        edited: state.edited || Boolean(state.content),
        selected: Math.max(0, Math.min(state.selected, images.length - 1)),
        saveAttempt: normalizeCaptureState({ ...state, images }).saveAttempt,
      })
    }
    case 'move': {
      const images = [...state.images]
      const from = images.findIndex((i) => i.id === action.id)
      const to = from + action.delta
      if (from < 0 || to < 0 || to >= images.length) {
        return state
      }
      const selectedId = state.images[state.selected]?.id
      ;[images[from], images[to]] = [images[to], images[from]]
      return invalidatePaperRequest({
        ...state,
        images,
        content: state.edited || state.mode === 'image' ? state.content : recognizedContent(images),
        selected: images.findIndex((i) => i.id === selectedId),
      })
    }
    case 'content':
      return invalidatePaperRequest({ ...state, content: action.content, edited: true })
    case 'question':
      return invalidatePaperRequest({ ...state, question: !state.question })
    case 'error':
      return { ...state, error: action.message }
    case 'run':
      return {
        ...state,
        activeRunId: action.runId,
        error: '',
        images: state.images.map((image) =>
          action.ids.includes(image.id) ? { ...image, status: 'waiting' } : image,
        ),
      }
    case 'cancel-run':
      if (state.activeRunId !== action.runId) {
        return state
      }
      return {
        ...state,
        activeRunId: null,
        images: state.images.map((image) =>
          image.status === 'working' ? { ...image, status: 'waiting' } : image,
        ),
      }
    case 'result':
      return {
        ...state,
        images: state.images.map((i) =>
          i.id === action.id &&
          (action.version === undefined || i.version === action.version) &&
          (action.runId === undefined || state.activeRunId === action.runId)
            ? { ...i, status: action.status, text: action.text ?? i.text }
            : i,
        ),
      }
    case 'crop': {
      const images = state.images.map((image) =>
        image.id === action.id
          ? {
              ...image,
              uri: action.uri,
              width: action.width,
              height: action.height,
              sizeBytes: action.sizeBytes,
              mimeType: action.mimeType ?? image.mimeType,
              version: image.version + 1,
              status: 'waiting' as const,
              text: '',
              uploadId: undefined,
              missing: false,
            }
          : image,
      )
      return invalidatePaperRequest({
        ...state,
        images,
        content: state.edited || state.mode === 'image' ? state.content : recognizedContent(images),
        saveAttempt: normalizeCaptureState({ ...state, images }).saveAttempt,
      })
    }
    case 'save-progress':
      return { ...state, saveCompleted: action.completed }
    case 'begin-save':
      return {
        ...state,
        saveCompleted: 0,
        saveAttempt: { ...state.saveAttempt, idempotencyKey: action.idempotencyKey },
      }
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
      }
    case 'edit':
      return {
        ...state,
        page: 'editor',
        content:
          state.edited || state.mode === 'image' ? state.content : recognizedContent(state.images),
      }
    case 'recover':
      return action.keep ? { ...state, recovery: false } : createCaptureState(state.mode)
  }
}
export const captureStatusLabels: Record<ImageStatus, string> = {
  waiting: '等待识别',
  working: '识别中…',
  done: '已完成',
  failed: '识别失败',
  empty: '未检测到文字',
}
export function captureSummary(state: CaptureState) {
  const done = state.images.filter((i) => i.status === 'done').length
  const failed = state.images.filter((i) => i.status === 'failed').length
  const working = state.images.some((i) => i.status === 'working' || i.status === 'waiting')
  return {
    done,
    failed,
    working,
    canSave: Boolean(
      (state.content.trim() || state.images.length) &&
      !state.images.some((i) => i.missing) &&
      state.content.length <= 20000,
    ),
    title: working
      ? '把图片变成文字'
      : done
        ? failed
          ? '有图片还没识别好'
          : '识别完成'
        : failed
          ? '暂时无法识别'
          : '没有识别到文字',
  }
}
/** 仅供独立设计预览入口；正式采集流程不使用示例结果。 */
export const captureScenarios = [
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
] as const
export function createCaptureScenario(name: string, uris: string[]): CaptureState {
  const state = createCaptureState(
    ['image', 'limit', 'list', 'detail'].includes(name) ? 'image' : 'ocr',
  )
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
  }))
  state.selected = name === 'limit' ? 8 : 1
  state.content = ['image', 'list', 'detail'].includes(name)
    ? ''
    : state.images.map((i) => i.text).join('\n\n')
  if (['image', 'result', 'recovery', 'missing'].includes(name)) {
    state.page = 'editor'
  }
  if (
    name === 'sort' ||
    name === 'viewer' ||
    name === 'detail' ||
    name === 'permission' ||
    name === 'list'
  ) {
    state.page = name
  }
  if (name === 'saving' || name === 'save-error') {
    state.page = 'saving'
    state.images[1].status = name === 'saving' ? 'working' : 'failed'
    state.images[2].status = 'waiting'
    state.error = name === 'save-error' ? '第 2 张图片上传失败，文字和图片已保留' : ''
  }
  if (['working', 'partial', 'failed', 'empty'].includes(name)) {
    state.page = 'recognition'
    state.images = state.images.map((i, n) => ({
      ...i,
      status:
        name === 'working'
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
    }))
  }
  state.recovery = name === 'recovery'
  if (name === 'missing') {
    state.images[1] = { ...state.images[1], missing: true, uri: '' }
  }
  return state
}

export interface CaptureMediaPort {
  persist(image: CaptureImage, accountId: string): Promise<CaptureImage>
  remove(image: CaptureImage): Promise<void>
}

export interface CaptureOcrResult {
  imageId: string
  version: number
  text: string
}

export interface CaptureOcrPort {
  recognize(image: CaptureImage, signal?: AbortSignal): Promise<CaptureOcrResult>
}

export interface CaptureDraftPort {
  load(accountId: string): Promise<CaptureState | null>
  save(accountId: string, state: CaptureState): Promise<void>
  clear(accountId: string): Promise<void>
}

export interface CaptureSavePort {
  save(
    input: CaptureSaveInput,
    onProgress: (completed: number) => void,
    onUploadReserved: (checkpoint: CaptureUploadCheckpoint) => Promise<void>,
  ): Promise<{ id: string }>
}

export interface CaptureSaveInput {
  content: string
  images: CaptureImage[]
  question: boolean
  idempotencyKey: string
  uploadsByImageVersion: Record<string, string>
}

export interface CaptureUploadCheckpoint {
  imageId: string
  version: number
  uploadId: string
}

/** 为一次保存生成或复用稳定的幂等键。 */
export function prepareCaptureSave(
  state: CaptureState,
  createId: () => string,
): { state: CaptureState; input: CaptureSaveInput } {
  const idempotencyKey = state.saveAttempt.idempotencyKey ?? createId()
  const next = captureReducer(state, { type: 'begin-save', idempotencyKey })
  return {
    state: next,
    input: {
      content: next.content,
      images: next.images,
      question: Boolean(next.content.trim()) && next.question,
      idempotencyKey,
      uploadsByImageVersion: next.saveAttempt.uploadsByImageVersion,
    },
  }
}

export function applyCaptureUploadCheckpoint(
  state: CaptureState,
  checkpoint: CaptureUploadCheckpoint,
): CaptureState {
  return captureReducer(state, {
    type: 'reserve-upload',
    id: checkpoint.imageId,
    version: checkpoint.version,
    uploadId: checkpoint.uploadId,
  })
}

/** OCR 错误只向页面暴露稳定的用户文案。 */
export function captureOcrErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error)
  const messages: Record<string, string> = {
    OCR_UNAUTHENTICATED: '登录已失效，请重新登录后识别',
    OCR_IMAGE_TOO_LARGE: '图片过大，请裁剪后重试',
    OCR_RATE_LIMITED: '今日识别次数已用完，图片仍可直接保存',
    OCR_NOT_CONFIGURED: '识别服务暂未开放，图片仍可直接保存',
    OCR_DISABLED: '识别服务暂时关闭，图片仍可直接保存',
    OCR_TIMEOUT: '识别超时，请稍后重试',
    OCR_PROVIDER_FAILED: '识别服务暂时不可用，请稍后重试',
  }
  return messages[code] ?? '识别失败，请重试或直接保存图片'
}

/** 用户编辑后不再自动改写正文。 */
export function mergeRecognizedText(current: string, recognized: string, edited: boolean): string {
  if (edited || !recognized.trim()) {
    return current
  }
  return [current.trim(), recognized.trim()].filter(Boolean).join('\n\n')
}

export type CaptureTaskEvent =
  | { type: 'working'; id: string; version: number; runId: string }
  | {
      type: 'result'
      id: string
      version: number
      runId: string
      status: 'done' | 'empty'
      text: string
    }
  | { type: 'failed'; id: string; version: number; runId: string; error: unknown }

/** 串行识别，失败项互不影响；取消后立即停止启动下一项。 */
export async function runCaptureRecognition(
  images: CaptureImage[],
  port: CaptureOcrPort,
  runId: string,
  signal: AbortSignal,
  emit: (event: CaptureTaskEvent) => void,
): Promise<void> {
  for (const image of images) {
    if (signal.aborted) {
      return
    }
    emit({ type: 'working', id: image.id, version: image.version, runId })
    try {
      const result = await port.recognize(image, signal)
      if (signal.aborted) {
        return
      }
      emit({
        type: 'result',
        id: result.imageId,
        version: result.version,
        runId,
        status: result.text.trim() ? 'done' : 'empty',
        text: result.text,
      })
    } catch (error) {
      if (signal.aborted) {
        return
      }
      emit({ type: 'failed', id: image.id, version: image.version, runId, error })
    }
  }
}
