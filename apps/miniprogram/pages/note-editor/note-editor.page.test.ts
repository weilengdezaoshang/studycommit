import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('../../services/mock-papers', () => ({
  getMockPapersApi: () => apiMocks,
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
  it('保存时提交正文图片和问题标记', async () => {
    const context = createPageContext({
      content: '  为什么会这样？  ',
      isQuestionActive: true,
      photoPath: '/saved/photo.jpg',
    })

    await pageDefinition.saveNote.call(context)

    expect(apiMocks.create).toHaveBeenCalledWith({
      content: '为什么会这样？',
      hasQuestion: true,
      photoPath: '/saved/photo.jpg',
    })
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
})
