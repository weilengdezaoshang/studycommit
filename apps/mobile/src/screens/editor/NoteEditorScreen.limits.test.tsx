import { act, fireEvent, render } from '@testing-library/react-native'
import { NoteEditorScreen } from './NoteEditorScreen'
import { createMobileDraftStorage } from '../../features/papers/draft-storage'

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

describe('NoteEditorScreen content limit', () => {
  beforeEach(async () => {
    mockGoBack.mockClear()
    await createMobileDraftStorage().save(null)
  })

  it('正文接近上限时显示字数反馈,超限时禁用记下并提示草稿保留', async () => {
    const view = await render(<NoteEditorScreen />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    const input = await view.findByPlaceholderText('写点什么吧……')

    // 接近上限(≥18000)出现计数,仍可正常保存
    const nearLimitText = '字'.repeat(18_000)
    fireEvent.changeText(input, nearLimitText)
    expect(await view.findByText('18,000 / 20,000')).toBeTruthy()

    // 超过上限:计数提示、记下禁用、明确说明草稿保留
    const overLimitText = `${nearLimitText}${'字'.repeat(2_500)}`
    fireEvent.changeText(input, overLimitText)
    expect(await view.findByText('20,500 / 20,000')).toBeTruthy()
    expect(view.getByText('正文最多 20000 字，草稿已保留')).toBeTruthy()
    expect(view.getByLabelText('记下').props.accessibilityState.disabled).toBe(true)
    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
