import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../../services/papers-api', () => ({
  getPapersApi: () => apiMocks,
}))

type PageDefinition = {
  data: Record<string, unknown>
  saveNote: (this: PageContext) => Promise<void>
}

type PageContext = {
  data: Record<string, unknown> & {
    content: string
    isQuestionActive: boolean
    photoPath: string
    isSaving: boolean
  }
  setData: (patch: Record<string, unknown>) => void
}

let pageDefinition: PageDefinition
const removeStorageSync = vi.fn()
const showToast = vi.fn()

beforeAll(async () => {
  vi.stubGlobal('Page', (definition: PageDefinition) => {
    pageDefinition = definition
  })
  vi.stubGlobal('wx', {
    removeStorageSync,
    showToast,
    navigateBack: vi.fn(),
  })
  await import('./note-editor')
})

beforeEach(() => {
  apiMocks.create.mockReset()
  apiMocks.create.mockResolvedValue({ id: 'paper-id' })
  removeStorageSync.mockReset()
  showToast.mockReset()
})

function createPageContext(patch: Partial<PageContext['data']> = {}): PageContext {
  const context: PageContext = {
    data: {
      ...pageDefinition.data,
      content: '',
      isQuestionActive: false,
      photoPath: '',
      isSaving: false,
      ...patch,
    },
    setData(next) {
      Object.assign(context.data, next)
    },
  }
  return context
}

describe('note-editor 页面', () => {
  it('保存时提交正文图片和问题标记，并携带幂等键', async () => {
    const context = createPageContext({
      content: '  为什么会这样？  ',
      isQuestionActive: true,
      photoPath: '/saved/photo.jpg',
    })

    await pageDefinition.saveNote.call(context)

    expect(apiMocks.create).toHaveBeenCalledWith(
      {
        content: '为什么会这样？',
        hasQuestion: true,
        photoPath: '/saved/photo.jpg',
      },
      { idempotencyKey: expect.any(String) },
    )
    expect(removeStorageSync).toHaveBeenCalledOnce()
  })

  it('正文为空时保留草稿且不发起保存', async () => {
    const context = createPageContext({ content: '   ', isQuestionActive: true })

    await pageDefinition.saveNote.call(context)

    expect(apiMocks.create).not.toHaveBeenCalled()
    expect(removeStorageSync).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith({ title: '先写下学习内容', icon: 'none' })
  })

  it('保存失败时恢复按钮并提示重试', async () => {
    apiMocks.create.mockRejectedValueOnce(new Error('offline'))
    const context = createPageContext({ content: '离线草稿' })

    await pageDefinition.saveNote.call(context)

    expect(context.data.isSaving).toBe(false)
    expect(removeStorageSync).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith({ title: '保存失败，请稍后重试', icon: 'none' })
  })

  it('保存失败后重试复用同一幂等键，成功后再次保存换新键', async () => {
    apiMocks.create.mockRejectedValueOnce(new Error('offline'))
    const context = createPageContext({ content: '网络不稳的内容' })

    await pageDefinition.saveNote.call(context)
    const firstKey = apiMocks.create.mock.calls[0][1].idempotencyKey

    await pageDefinition.saveNote.call(context)

    expect(apiMocks.create).toHaveBeenCalledTimes(2)
    expect(apiMocks.create.mock.calls[1][1].idempotencyKey).toBe(firstKey)

    // 成功保存会清掉幂等键;真实页面随后返回,再次进入编辑器时应生成新键
    apiMocks.create.mockRejectedValueOnce(new Error('offline'))
    context.data.isSaving = false
    context.data.content = '再记一条'
    await pageDefinition.saveNote.call(context)
    const newKey = apiMocks.create.mock.calls[2][1].idempotencyKey
    expect(newKey).not.toBe(firstKey)
  })
})
