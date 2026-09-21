jest.mock('expo-crypto', () => ({ randomUUID: () => '9a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d' }))
jest.mock('../../components/RichTextEditor', () =>
  jest.requireActual('../../test/mock-rich-editor'),
)
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { NoteEditorScreen } from './NoteEditorScreen'
import { createMobileDraftStorage } from '../../features/papers/draft-storage'
import type { PaperDraft } from '@studycommit/common/paper-react'

const mockGoBack = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('../../core/MobileServicesProvider', () => ({
  useMobileServices: () => ({ uploads: {} }),
}))

const storedDraft: PaperDraft = {
  paperId: '9a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
  content: '上次没保存的正文',
  hasQuestion: false,
  assetUploadIds: [],
  localPhotoUri: null,
  updatedAt: 1_720_000_000_000,
  attempts: 0,
}

async function renderEditor() {
  const view = await render(<NoteEditorScreen />)
  // 用真实定时器冲刷挂载时的草稿恢复状态更新
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return view
}

describe('NoteEditorScreen draft recovery', () => {
  beforeEach(async () => {
    mockGoBack.mockClear()
    await createMobileDraftStorage().save(null)
  })

  it('空草稿不显示已恢复或已保存提示', async () => {
    await createMobileDraftStorage().save({ ...storedDraft, content: '' })
    const view = await renderEditor()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })
    expect(view.queryByText('已恢复上次未保存的内容')).toBeNull()
    expect(view.queryByText(/^草稿已保存/)).toBeNull()
    expect(view.getByText('写点什么吧')).toBeTruthy()
  })

  it('退出后重新打开恢复刚输入的正文', async () => {
    const view = await renderEditor()
    await fireEvent.changeText(view.getByPlaceholderText('写点什么吧……'), '退出前写下的内容')
    expect(view.getByDisplayValue('退出前写下的内容')).toBeTruthy()
    await fireEvent.press(view.getByText('取消'))
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1))
    await view.unmount()
    expect((await createMobileDraftStorage().load())?.content).toBe('退出前写下的内容')
    const reopened = await renderEditor()
    expect(await reopened.findByDisplayValue('退出前写下的内容')).toBeTruthy()
  })

  it('退出时本机写入失败则留在编辑器并显示失败提示', async () => {
    const view = await renderEditor()
    await fireEvent.changeText(view.getByPlaceholderText('写点什么吧……'), '不能丢失的内容')
    const write = jest.mocked(AsyncStorage.setItem)
    write.mockRejectedValueOnce(new Error('写入失败'))
    try {
      await fireEvent.press(view.getByText('取消'))
      expect(await view.findByText('草稿未能保存，请重试退出')).toBeTruthy()
      expect(mockGoBack).not.toHaveBeenCalled()
      expect(view.getByDisplayValue('不能丢失的内容')).toBeTruthy()
    } finally {
      await view.unmount()
    }
  })

  it('继续输入后不再显示旧的保存成功状态', async () => {
    const view = await renderEditor()
    await fireEvent.changeText(view.getByPlaceholderText('写点什么吧……'), '第一段')
    await waitFor(() => expect(view.getByText(/^草稿已保存/)).toBeTruthy())
    await fireEvent.changeText(view.getByPlaceholderText('写点什么吧……'), '第二段')
    expect(view.queryByText(/^草稿已保存/)).toBeNull()
  })

  it('本地存有草稿时自动恢复并提示,丢弃后清空可重新记录', async () => {
    await createMobileDraftStorage().save(storedDraft)

    const view = await renderEditor()

    // 正文完整恢复并出现恢复提示
    expect(await view.findByDisplayValue('上次没保存的正文')).toBeTruthy()
    expect(await view.findByText('已恢复上次未保存的内容')).toBeTruthy()

    // 丢弃后输入框清空,提示消失
    await fireEvent.press(view.getByLabelText('丢弃恢复的草稿'))
    await waitFor(() => {
      expect(view.getByPlaceholderText('写点什么吧……').props.value).toBe('')
    })
    expect(view.queryByText('已恢复上次未保存的内容')).toBeNull()
  })
})
