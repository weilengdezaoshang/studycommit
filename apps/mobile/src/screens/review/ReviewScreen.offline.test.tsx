import { act, render } from '@testing-library/react-native'
import { ReviewScreen } from './ReviewScreen'

const mockMonthly = jest.fn()
// 服务对象必须稳定:每次渲染新建会触发 effect 无限重跑
const mockServices = { reviews: { monthly: mockMonthly } }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('../../core/MobileServicesProvider', () => ({
  useMobileServices: () => mockServices,
}))

describe('ReviewScreen offline fallback', () => {
  beforeEach(() => {
    mockMonthly.mockReset()
  })

  it('服务端不可用时回退本地聚合并提示离线统计', async () => {
    const rejectors: Array<(error: Error) => void> = []
    mockMonthly.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectors.push(reject)
        }),
    )

    const view = await render(<ReviewScreen />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    // effect 已发起请求
    expect(rejectors.length).toBeGreaterThan(0)

    // 在 act 内触发失败,保证失败分支的状态更新落地
    await act(async () => {
      rejectors[0](new Error('网络不可用'))
      await Promise.resolve()
    })

    expect(await view.findByText('离线统计，联网后自动同步')).toBeTruthy()
  })
})
