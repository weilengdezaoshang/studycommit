import { describe, expect, it } from 'vitest'
import {
  applyCaptureUploadCheckpoint,
  captureOcrErrorMessage,
  captureReducer,
  captureSummary,
  createCaptureScenario,
  createCaptureState,
  mergeRecognizedText,
  normalizeCaptureState,
  prepareCaptureSave,
  runCaptureRecognition,
  type CaptureImage,
  type CaptureOcrPort,
  type CaptureOcrResult,
  type CaptureTaskEvent,
} from './index'
const example = () => createCaptureScenario('result', ['a', 'b', 'c'])
describe('captureReducer', () => {
  it('超出九张时保留原队列并提示上限', () => {
    const state = createCaptureScenario('limit', ['a'])
    const next = captureReducer(state, {
      type: 'add',
      images: [{ id: 'extra', uri: 'b', version: 1, status: 'waiting', text: '' }],
    })
    expect(next.images).toEqual(state.images)
    expect(next.error).toContain('9')
  })
  it('移动图片后选中图片身份保持不变', () => {
    const state = example()
    const selected = state.images[state.selected].id
    const next = captureReducer(state, { type: 'move', id: selected, delta: -1 })
    expect(next.images[next.selected].id).toBe(selected)
    expect(next.selected).toBe(0)
  })
  it('删除附件保留已编辑正文并修正选中位置', () => {
    let state = captureReducer(example(), { type: 'content', content: '我自己补充的文字' })
    for (const item of state.images) {
      state = captureReducer(state, { type: 'remove', id: item.id })
    }
    expect(state.content).toBe('我自己补充的文字')
    expect(state.selected).toBe(0)
    expect(state.images).toHaveLength(0)
  })
  it('重新进入编辑不会用识别结果覆盖用户修改', () => {
    let state = captureReducer(example(), { type: 'content', content: '修改后的内容' })
    state = captureReducer(state, {
      type: 'result',
      id: state.images[0].id,
      status: 'done',
      text: '迟到结果',
    })
    expect(captureReducer(state, { type: 'edit' }).content).toBe('修改后的内容')
  })
  it('原始结果按当前图片顺序合并', () => {
    const state = example()
    const sorted = captureReducer(state, { type: 'move', id: state.images[1].id, delta: -1 })
    expect(sorted.content.split('\n\n')[0]).toBe(state.images[1].text)
  })
  it('允许纯图片继续保存但阻止缺失附件或超长正文', () => {
    expect(captureSummary(createCaptureScenario('image', ['a'])).canSave).toBe(true)
    expect(captureSummary(createCaptureScenario('missing', ['a'])).canSave).toBe(false)
    expect(captureSummary({ ...example(), content: '字'.repeat(20001) }).canSave).toBe(false)
    expect(captureSummary(createCaptureState()).canSave).toBe(false)
  })
  it('重新裁剪递增版本并丢弃旧识别结果', () => {
    const state = example()
    const image = state.images[0]
    const cropped = captureReducer(state, {
      type: 'crop',
      id: image.id,
      uri: 'cropped',
      width: 100,
      height: 80,
    })
    const late = captureReducer(cropped, {
      type: 'result',
      id: image.id,
      version: image.version,
      status: 'done',
      text: '旧结果',
    })
    expect(late.images[0]).toMatchObject({
      uri: 'cropped',
      version: 2,
      status: 'waiting',
      text: '',
    })
  })
  it('取消后拒绝同一任务的迟到结果', () => {
    const state = example()
    const image = state.images[0]
    const running = captureReducer(state, { type: 'run', runId: 'run-1', ids: [image.id] })
    const cancelled = captureReducer(running, { type: 'cancel-run', runId: 'run-1' })
    const late = captureReducer(cancelled, {
      type: 'result',
      id: image.id,
      version: image.version,
      runId: 'run-1',
      status: 'done',
      text: '迟到结果',
    })
    expect(late.images[0].text).toBe(image.text)
  })
  it('重启后复用保存幂等键和已预留上传会话', () => {
    const initial = createCaptureScenario('image', ['a'])
    const first = prepareCaptureSave(initial, () => 'save-1')
    const checkpointed = applyCaptureUploadCheckpoint(first.state, {
      imageId: first.state.images[0].id,
      version: first.state.images[0].version,
      uploadId: 'upload-1',
    })
    const restored = normalizeCaptureState(JSON.parse(JSON.stringify(checkpointed)))
    const retried = prepareCaptureSave(restored, () => 'save-2')
    expect(retried.input.idempotencyKey).toBe('save-1')
    expect(Object.values(retried.input.uploadsByImageVersion)).toEqual(['upload-1'])
  })
  it('内容变更后更换幂等键但保留同版本上传会话', () => {
    const initial = prepareCaptureSave(createCaptureScenario('image', ['a']), () => 'save-1')
    const image = initial.state.images[0]
    const checkpointed = applyCaptureUploadCheckpoint(initial.state, {
      imageId: image.id,
      version: image.version,
      uploadId: 'upload-1',
    })
    const edited = captureReducer(checkpointed, { type: 'content', content: '新正文' })
    const retried = prepareCaptureSave(edited, () => 'save-2')
    expect(retried.input.idempotencyKey).toBe('save-2')
    expect(Object.values(retried.input.uploadsByImageVersion)).toEqual(['upload-1'])
  })
  it('用户编辑后不合并迟到的识别文字', () => {
    expect(mergeRecognizedText('用户文字', '识别文字', true)).toBe('用户文字')
    expect(mergeRecognizedText('第一张', '第二张', false)).toBe('第一张\n\n第二张')
  })
})

describe('captureOcrErrorMessage', () => {
  it('客户端按错误码映射统一用户文案', () => {
    expect(captureOcrErrorMessage(new Error('OCR_UNAUTHENTICATED'))).toBe(
      '登录已失效，请重新登录后识别',
    )
    expect(captureOcrErrorMessage(new Error('OCR_DISABLED'))).toBe(
      '识别服务暂时关闭，图片仍可直接保存',
    )
    expect(captureOcrErrorMessage(new Error('OCR_RATE_LIMITED'))).toBe(
      '今日识别次数已用完，图片仍可直接保存',
    )
    expect(captureOcrErrorMessage(new Error('OCR_TIMEOUT'))).toBe('识别超时，请稍后重试')
  })

  it('未知错误返回兜底文案', () => {
    expect(captureOcrErrorMessage(new Error('SOMETHING_ELSE'))).toBe(
      '识别失败，请重试或直接保存图片',
    )
    expect(captureOcrErrorMessage('OCR_IMAGE_TOO_LARGE')).toBe('图片过大，请裁剪后重试')
  })
})

describe('runCaptureRecognition', () => {
  const image = (id: string): CaptureImage => ({
    id,
    uri: id,
    version: 1,
    status: 'waiting',
    text: '',
  })

  it('单张识别失败不阻断其余图片', async () => {
    const events: CaptureTaskEvent[] = []
    const port: CaptureOcrPort = {
      recognize: async (current) => {
        if (current.id === 'a') {
          throw new Error('OCR_TIMEOUT')
        }
        return { imageId: current.id, version: current.version, text: '第二张文字' }
      },
    }
    await runCaptureRecognition(
      [image('a'), image('b')],
      port,
      'run-1',
      new AbortController().signal,
      (event) => events.push(event),
    )
    expect(events.map((event) => event.type)).toEqual(['working', 'failed', 'working', 'result'])
    expect(events[3]).toMatchObject({ id: 'b', status: 'done', text: '第二张文字' })
  })

  it('取消后丢弃迟到结果且不再识别剩余图片', async () => {
    const events: CaptureTaskEvent[] = []
    let resolveRecognized!: (result: CaptureOcrResult) => void
    const recognized = new Promise<CaptureOcrResult>((resolve) => {
      resolveRecognized = resolve
    })
    const controller = new AbortController()
    const port: CaptureOcrPort = { recognize: () => recognized }
    const running = runCaptureRecognition(
      [image('a'), image('b')],
      port,
      'run-1',
      controller.signal,
      (event) => events.push(event),
    )
    await Promise.resolve()
    controller.abort()
    resolveRecognized({ imageId: 'a', version: 1, text: '迟到的文字' })
    await running
    expect(events.map((event) => event.type)).toEqual(['working'])
    expect(events[0]).toMatchObject({ id: 'a', runId: 'run-1' })
  })
})
