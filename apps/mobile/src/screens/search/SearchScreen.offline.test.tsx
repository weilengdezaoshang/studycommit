import { act, fireEvent, render } from '@testing-library/react-native'
import { SearchScreen } from './SearchScreen'

const mockNavigate = jest.fn()
const mockQuery = jest.fn()
const mockServices = { search: { query: mockQuery } }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('../../core/MobileServicesProvider', () => ({
  useMobileServices: () => mockServices,
}))

describe('SearchScreen offline fallback', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockQuery.mockReset()
  })

  it('云端搜索失败时回退本地过滤并提示不可用', async () => {
    const rejectors: Array<(error: Error) => void> = []
    mockQuery.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectors.push(reject)
        }),
    )

    const view = await render(<SearchScreen />)

    // 输入与防抖在 act 外发生(与成功用例一致);仅失败分支包回 act,保证状态更新落地
    fireEvent.changeText(view.getByPlaceholderText('搜索纸页与主题'), '调度')
    for (let i = 0; i < 40 && mockQuery.mock.calls.length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    await act(async () => {
      expect(rejectors.length).toBeGreaterThan(0)
      rejectors[0](new Error('网络不可用'))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(await view.findByText('云端搜索不可用，正在展示本机记录')).toBeTruthy()
  })
})
