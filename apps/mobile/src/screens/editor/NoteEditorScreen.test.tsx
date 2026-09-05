import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { NoteEditorScreen } from './NoteEditorScreen'
import { createMobileDraftStorage } from '../../features/papers/draft-storage'
import { getPapersState } from '../../features/papers/papers-store'

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

async function renderEditor() {
  const view = await render(<NoteEditorScreen />)
  // 用真实定时器冲刷挂载时的草稿加载状态更新
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return view
}

describe('NoteEditorScreen save flow', () => {
  beforeEach(async () => {
    mockGoBack.mockClear()
    await createMobileDraftStorage().save(null)
  })

  it('空白正文先给提示,输入正文记下后创建纸页并返回首页', async () => {
    const view = await renderEditor()

    // 等待草稿锚点建立完成(loading 结束后提示出现)
    await view.findByText('自动保存中')

    // 空白正文直接记下:给出校验提示且不返回
    fireEvent.press(view.getByLabelText('记下'))
    expect(await view.findByText('先写点什么再记下')).toBeTruthy()
    expect(mockGoBack).not.toHaveBeenCalled()

    // 输入正文后记下:创建纸页并返回
    fireEvent.changeText(view.getByPlaceholderText('写点什么吧……'), '刚理解的幂等键设计')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.press(view.getByLabelText('记下'))

    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled()
    })
    expect(getPapersState().papers.some((paper) => paper.content === '刚理解的幂等键设计')).toBe(
      true,
    )
  })
})
