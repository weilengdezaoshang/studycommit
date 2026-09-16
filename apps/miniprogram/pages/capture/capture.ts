import {
  captureReducer,
  captureImageVersionKey,
  captureSummary,
  captureStatusLabels,
  applyCaptureUploadCheckpoint,
  prepareCaptureSave,
  createCaptureState,
  createCaptureScenario,
  runCaptureRecognition,
  type CaptureAction,
  type CaptureOcrPort,
  type CaptureState,
  type CaptureTaskEvent,
} from '../../shared/capture-runtime/index'
import { getCustomNavigationMetrics } from '../../utils/navigation'
import { getMiniprogramServices } from '../../infrastructure/services/service-context'
import { captureServiceErrorMessage } from '../../infrastructure/services/error-messages'
import { createIdempotencyKey } from '../../utils/uuid'
import { clearCaptureDraft, loadCaptureDraft, saveCaptureDraft } from '../../services/capture-draft'
const titles = {
  preview: '图片预览',
  sort: '调整顺序',
  recognition: '识别文字',
  editor: '图片记录',
  viewer: '查看图片',
  permission: '添加图片',
  saving: '正在保存',
  detail: '记录详情',
  list: '记录本',
}
const examples = [
  '/assets/capture/sample-1.svg',
  '/assets/capture/sample-2.svg',
  '/assets/capture/sample-3.svg',
]
/** OCR 端口只暴露公共 CaptureOcrResult，页面不接触云函数与腾讯云协议字段。 */
const cloudOcrPort: CaptureOcrPort = {
  recognize: (image) =>
    getMiniprogramServices().ocr.recognize({
      imageId: image.id,
      version: image.version,
      localPath: image.uri,
    }),
}
type Event = WechatMiniprogram.TouchEvent
type OcrRunState = { ocrAbort?: AbortController }
Page({
  data: {
    ...getCustomNavigationMetrics(),
    state: createCaptureState(),
    summary: captureSummary(createCaptureState()),
    title: '图片预览',
    rows: [] as { id: string; uri: string; label: string; missing: boolean }[],
    currentUri: '',
    preview: false,
    sourceOpen: false,
    picking: false,
    hydrated: false,
    activeRunId: '',
  },
  async onLoad(query: Record<string, string | undefined>) {
    const preview = Boolean(query.scenario)
    const state = preview
      ? createCaptureScenario(query.scenario!, examples)
      : createCaptureState(query.mode === 'image' ? 'image' : 'ocr')
    this.setData({
      preview,
      sourceOpen: false,
      hydrated: preview,
      ...getCustomNavigationMetrics(),
    })
    this.renderState(state)
    if (!preview) {
      const draft = await loadCaptureDraft()
      if (draft) {
        this.dispatch({ type: 'restore', state: draft })
      } else {
        this.setData({ sourceOpen: true })
      }
      this.setData({ hydrated: true })
    }
  },
  onHide() {
    if (!this.data.preview && (this.data.state.images.length || this.data.state.content.trim())) {
      void saveCaptureDraft(this.data.state).catch(() => undefined)
    }
  },
  renderState(state: CaptureState) {
    if (!this.data.preview && (state.images.length || state.content.trim())) {
      wx.enableAlertBeforeUnload({ message: '图片记录尚未保存，离开后将丢失' })
    }

    this.setData({
      state,
      summary: captureSummary(state),
      title: state.page === 'editor' && state.mode === 'ocr' ? '识别结果' : titles[state.page],
      currentUri: state.images[state.selected]?.uri ?? '',
      rows: state.images.map((i) => ({
        id: i.id,
        uri: i.uri,
        missing: Boolean(i.missing),
        label:
          state.page === 'saving'
            ? {
                done: '已上传',
                working: '上传中…',
                failed: '上传失败',
                waiting: '等待上传',
                empty: '等待上传',
              }[i.status]
            : captureStatusLabels[i.status],
      })),
    })
  },
  dispatch(action: CaptureAction) {
    this.renderState(captureReducer(this.data.state, action))
  },
  back() {
    if (this.data.preview || this.data.state.page === 'preview') {
      wx.navigateBack()
    } else {
      this.dispatch({ type: 'page', page: 'preview' })
    }
  },
  detail() {
    this.dispatch({ type: 'page', page: 'detail' })
  },
  openSource() {
    if (!this.data.hydrated) {
      return
    }
    this.setData({ sourceOpen: true })
  },
  closeSource() {
    this.setData({ sourceOpen: false })
  },
  camera() {
    this.choose('camera')
  },
  album() {
    this.choose('album')
  },
  choose(source: 'camera' | 'album') {
    if (this.data.picking || this.data.state.images.length >= 9) {
      return
    }
    this.setData({ picking: true, sourceOpen: false })
    wx.chooseMedia({
      count: source === 'camera' ? 1 : 9 - this.data.state.images.length,
      mediaType: ['image'],
      sourceType: [source],
      success: (result) => {
        this.dispatch({
          type: 'add',
          images: result.tempFiles.map((file, index) => ({
            id: `${Date.now()}-${index}`,
            uri: file.tempFilePath,
            version: 1,
            status: 'waiting',
            text: '',
            sizeBytes: file.size,
            mimeType: file.tempFilePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
          })),
        })
        this.dispatch({ type: 'page', page: 'preview' })
      },
      fail: (error) => {
        if (!error.errMsg.includes('cancel')) {
          if (source === 'camera') {
            this.dispatch({ type: 'page', page: 'permission' })
          } else {
            this.dispatch({ type: 'error', message: '无法读取图片，请检查权限' })
          }
        }
      },
      complete: () => this.setData({ picking: false }),
    })
  },
  select(event: { detail: { index: number } }) {
    this.dispatch({ type: 'select', index: event.detail.index })
  },
  remove(event: { detail: { id: string } }) {
    this.dispatch({ type: 'remove', id: event.detail.id })
  },
  removeCurrent() {
    const item = this.data.state.images[this.data.state.selected]
    if (item) {
      this.dispatch({ type: 'remove', id: item.id })
    }
  },
  move(event: Event) {
    this.dispatch({
      type: 'move',
      id: String(event.currentTarget.dataset.id),
      delta: Number(event.currentTarget.dataset.delta),
    })
  },
  sortTouchStart(event: WechatMiniprogram.TouchEvent) {
    const touch = event.touches[0]
    ;(this as unknown as { sortStartY?: number }).sortStartY = touch?.clientY
  },
  sortTouchEnd(event: WechatMiniprogram.TouchEvent) {
    const startY = (this as unknown as { sortStartY?: number }).sortStartY
    const endY = event.changedTouches[0]?.clientY
    if (startY === undefined || endY === undefined || Math.abs(endY - startY) < 30) {
      return
    }
    const id = String(event.currentTarget.dataset.id)
    const index = this.data.state.images.findIndex((item) => item.id === id)
    const delta = endY < startY ? 1 : -1
    if ((delta < 0 && index === 0) || (delta > 0 && index === this.data.state.images.length - 1)) {
      return
    }
    this.dispatch({ type: 'move', id, delta })
  },
  sort() {
    this.dispatch({ type: 'page', page: 'sort' })
  },
  previewImages() {
    const runId = this.data.activeRunId
    if (runId) {
      ;(this as unknown as OcrRunState).ocrAbort?.abort()
      this.setData({ activeRunId: '' })
      this.dispatch({ type: 'cancel-run', runId })
    }
    this.dispatch({ type: 'page', page: 'preview' })
  },
  edit() {
    this.dispatch({ type: 'edit' })
  },
  proceed() {
    if (this.data.state.mode === 'image') {
      this.edit()
    } else {
      void this.recognize()
    }
  },
  applyTaskEvent(event: CaptureTaskEvent) {
    if (event.type === 'working') {
      this.dispatch({
        type: 'result',
        id: event.id,
        version: event.version,
        runId: event.runId,
        status: 'working',
      })
      return
    }
    if (event.type === 'failed') {
      this.dispatch({
        type: 'result',
        id: event.id,
        version: event.version,
        runId: event.runId,
        status: 'failed',
      })
      this.dispatch({ type: 'error', message: captureServiceErrorMessage(event.error) })
      return
    }
    this.dispatch({
      type: 'result',
      id: event.id,
      version: event.version,
      runId: event.runId,
      status: event.status,
      text: event.text,
    })
  },
  recognize(failedOnly = false) {
    if (this.data.preview) {
      this.dispatch({ type: 'error', message: '识别服务尚未接通，图片已保留' })
      return Promise.resolve()
    }
    const runState = this as unknown as OcrRunState
    runState.ocrAbort?.abort()
    const controller = new AbortController()
    runState.ocrAbort = controller
    const images = failedOnly
      ? this.data.state.images.filter((image) => image.status === 'failed')
      : this.data.state.images
    const runId = createIdempotencyKey()
    this.setData({ activeRunId: runId })
    this.dispatch({ type: 'page', page: 'recognition' })
    this.dispatch({ type: 'run', runId, ids: images.map((image) => image.id) })
    // 公共串行运行器：失败互不影响，取消后丢弃迟到结果、不再启动下一张。
    return runCaptureRecognition(images, cloudOcrPort, runId, controller.signal, (event) =>
      this.applyTaskEvent(event),
    )
  },
  retry() {
    void this.recognize(true)
  },
  crop() {
    const image = this.data.state.images[this.data.state.selected]
    if (!image) {
      return
    }
    wx.editImage({
      src: image.uri,
      success: (result) => {
        wx.getImageInfo({
          src: result.tempFilePath,
          success: (info) =>
            this.dispatch({
              type: 'crop',
              id: image.id,
              uri: result.tempFilePath,
              width: info.width,
              height: info.height,
            }),
        })
      },
      fail: (error) => {
        if (!error.errMsg.includes('cancel')) {
          this.dispatch({ type: 'error', message: '图片裁剪失败，请重试' })
        }
      },
    })
  },
  content(event: WechatMiniprogram.Input) {
    this.dispatch({ type: 'content', content: event.detail.value })
  },
  question() {
    this.dispatch({ type: 'question' })
  },
  async save() {
    if (this.data.preview) {
      this.dispatch({ type: 'error', message: '这是设计预览，未创建真实记录' })
      return
    }
    this.dispatch({ type: 'page', page: 'saving' })
    try {
      let prepared = prepareCaptureSave(this.data.state, createIdempotencyKey)
      this.dispatch({ type: 'begin-save', idempotencyKey: prepared.input.idempotencyKey })
      await saveCaptureDraft(prepared.state)
      const uploadIds: string[] = []
      let completed = 0
      for (const image of prepared.input.images) {
        const versionKey = captureImageVersionKey(image)
        let uploadId = prepared.state.saveAttempt.uploadsByImageVersion[versionKey]
        if (!uploadId) {
          uploadId = createIdempotencyKey()
          const checkpoint = { imageId: image.id, version: image.version, uploadId }
          prepared = {
            ...prepared,
            state: applyCaptureUploadCheckpoint(prepared.state, checkpoint),
          }
          this.dispatch({
            type: 'reserve-upload',
            id: image.id,
            version: image.version,
            uploadId,
          })
          await saveCaptureDraft(prepared.state)
        }
        await getMiniprogramServices().uploads.upload({
          path: image.uri,
          uploadId,
          mimeType: image.mimeType ?? 'image/jpeg',
        })
        uploadIds.push(uploadId)
        completed += 1
        this.dispatch({ type: 'save-progress', completed })
      }
      await getMiniprogramServices().papers.create(
        {
          content: this.data.state.content,
          hasQuestion: Boolean(this.data.state.content.trim()) && this.data.state.question,
          assetUploadIds: uploadIds,
        },
        { idempotencyKey: prepared.input.idempotencyKey },
      )
      wx.disableAlertBeforeUnload()
      await clearCaptureDraft(this.data.state)
      wx.navigateBack()
    } catch {
      this.dispatch({ type: 'error', message: '保存未完成，已上传图片会在本次重试中复用' })
    }
  },
  settings() {
    wx.openSetting({
      fail: () => this.dispatch({ type: 'error', message: '请手动前往设置开启权限' }),
    })
  },
  recover() {
    this.dispatch({ type: 'recover', keep: true })
  },
  discard() {
    void clearCaptureDraft(this.data.state)
    this.dispatch({ type: 'recover', keep: false })
  },
  view(event: Event) {
    const index = Number(event.currentTarget.dataset.index ?? this.data.state.selected)
    const urls = this.data.state.images.filter((i) => !i.missing).map((i) => i.uri)
    if (urls.length) {
      wx.previewImage({ urls, current: this.data.state.images[index]?.uri || urls[0] })
    }
  },
})
