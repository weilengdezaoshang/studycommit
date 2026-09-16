import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { CaptureImage, CaptureState, CaptureAction } from '../../shared/capture-runtime/index'
type Context = {
  data: {
    state: CaptureState
    preview: boolean
    sourceOpen: boolean
    activeRunId: string
  }
  setData(patch: Record<string, unknown>): void
  onLoad(query: Record<string, string>): void
  renderState(state: CaptureState): void
  dispatch(action: CaptureAction): void
  removeCurrent(): void
  edit(): void
  retry(): void
  recognize(failedOnly?: boolean): Promise<void>
  previewImages(): void
  save(): void
}
type CloudCallResolver = {
  resolve: (value: { result: unknown }) => void
  reject: (error: unknown) => void
}
let definition: Context
let pendingCalls: CloudCallResolver[]
const waitTick = () => new Promise((resolve) => setTimeout(resolve, 0))
function resolveCloudCall(result: unknown) {
  const call = pendingCalls.shift()
  if (!call) {
    throw new Error('没有待处理的云调用')
  }
  call.resolve({ result })
}
beforeAll(async () => {
  pendingCalls = []
  vi.stubGlobal('wx', {
    getWindowInfo: () => ({ statusBarHeight: 24 }),
    getMenuButtonBoundingClientRect: () => ({ top: 28, height: 32 }),
    enableAlertBeforeUnload: () => undefined,
    disableAlertBeforeUnload: () => undefined,
    getStorageSync: () => '',
    setStorageSync: () => undefined,
    removeStorageSync: () => undefined,
    env: { USER_DATA_PATH: '/user' },
    getFileSystemManager: () => ({
      readFile: (options: { filePath: string; success: (result: { data: string }) => void }) =>
        options.success({ data: 'QUJD' }),
    }),
    cloud: {
      callFunction: () =>
        new Promise<{ result: unknown }>((resolve, reject) => {
          pendingCalls.push({ resolve, reject })
        }),
      uploadFile: (options: {
        cloudPath: string
        filePath: string
        success: (result: { fileID: string }) => void
      }) => options.success({ fileID: `fileID:${options.cloudPath}` }),
    },
  })
  vi.stubGlobal('Page', (value: Context) => {
    definition = value
  })
  // 页面测试注入统一服务：transport 处理暂存登记，OCR 云调用经 pendingCalls 控制时序。
  const { configureMiniprogramServices } =
    await import('../../infrastructure/services/service-context')
  configureMiniprogramServices({
    mode: 'cloud-function',
    cloudAvailable: () => true,
    transport: {
      call: (async (operation: string) =>
        operation === 'uploads.stageTemp' ? { cloudPath: 'ocr-temp/t-1' } : {}) as never,
    },
  })
  await import('./capture')
})
function page(scenario: string): Context {
  const context = Object.assign(Object.create(definition) as Context, {
    data: { ...definition.data },
    setData(this: Context, patch: Record<string, unknown>) {
      Object.assign(this.data, patch)
    },
  })
  context.onLoad({ scenario })
  return context
}
async function realPage(): Promise<Context> {
  const context = Object.assign(Object.create(definition) as Context, {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(this: Context, patch: Record<string, unknown>) {
      Object.assign(this.data, patch)
    },
  })
  await context.onLoad({})
  return context
}
const draftImage = (): CaptureImage => ({
  id: 'img-1',
  uri: 'file://a',
  version: 1,
  status: 'waiting',
  text: '',
})
describe('小程序图片页面', () => {
  it('删除最后选中图片后仍能继续编辑剩余附件', () => {
    const view = page('preview')
    view.removeCurrent()
    expect(view.data.state.images).toHaveLength(2)
    view.edit()
    expect(view.data.state.page).toBe('editor')
    expect(view.data.state.content).toContain('合上书')
  })
  it('纯图片编辑不会自动填入示例识别文字', () => {
    const view = page('image')
    view.edit()
    expect(view.data.state.content).toBe('')
  })
  it('预览保存明确提示而不生成虚假成功记录', () => {
    const view = page('image')
    view.save()
    expect(view.data.state.error).toBe('这是设计预览，未创建真实记录')
    expect(view.data.state.images).toHaveLength(3)
  })
  it('取消识别后迟到的云结果不写回页面', async () => {
    const view = await realPage()
    view.dispatch({ type: 'add', images: [draftImage()] })
    const running = view.recognize()
    await waitTick()
    expect(view.data.state.images[0].status).toBe('working')
    view.previewImages()
    expect(view.data.state.images[0].status).toBe('waiting')
    resolveCloudCall({ ok: true, imageId: 'img-1', version: 1, text: '迟到的文字' })
    await running
    expect(view.data.state.images[0]).toMatchObject({ status: 'waiting', text: '' })
  })
  it('重新裁剪后旧版本的识别结果不写回', async () => {
    const view = await realPage()
    view.dispatch({ type: 'add', images: [draftImage()] })
    const running = view.recognize()
    await waitTick()
    view.dispatch({ type: 'crop', id: 'img-1', uri: 'file://b', width: 10, height: 10 })
    resolveCloudCall({ ok: true, imageId: 'img-1', version: 1, text: '旧版本文字' })
    await running
    expect(view.data.state.images[0]).toMatchObject({
      uri: 'file://b',
      version: 2,
      status: 'waiting',
      text: '',
    })
  })
  it('重试只重新识别失败的图片', async () => {
    const view = await realPage()
    view.dispatch({
      type: 'add',
      images: [draftImage(), { ...draftImage(), id: 'img-2', uri: 'file://b' }],
    })
    const first = view.recognize()
    await waitTick()
    resolveCloudCall({ ok: false, code: 'OCR_TIMEOUT' })
    await waitTick()
    resolveCloudCall({ ok: true, imageId: 'img-2', version: 1, text: '第二张文字' })
    await first
    expect(view.data.state.images[0]).toMatchObject({ status: 'failed' })
    expect(view.data.state.images[1]).toMatchObject({ status: 'done', text: '第二张文字' })
    const second = view.recognize(true)
    await waitTick()
    resolveCloudCall({ ok: true, imageId: 'img-1', version: 1, text: '第一张文字' })
    await second
    expect(pendingCalls).toHaveLength(0)
    expect(view.data.state.images[0]).toMatchObject({ status: 'done', text: '第一张文字' })
    expect(view.data.state.images[1]).toMatchObject({ status: 'done', text: '第二张文字' })
  })
})
