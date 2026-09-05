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

  it('本地存有草稿时自动恢复并提示,丢弃后清空可重新记录', async () => {
    await createMobileDraftStorage().save(storedDraft)

    const view = await renderEditor()

    // 正文完整恢复并出现恢复提示
    expect(await view.findByDisplayValue('上次没保存的正文')).toBeTruthy()
    expect(await view.findByText('已恢复上次未保存的内容')).toBeTruthy()

    // 丢弃后输入框清空,提示消失
    fireEvent.press(view.getByLabelText('丢弃恢复的草稿'))
    await waitFor(() => {
      expect(view.getByPlaceholderText('写点什么吧……').props.value).toBe('')
    })
    expect(view.queryByText('已恢复上次未保存的内容')).toBeNull()
  })
})
