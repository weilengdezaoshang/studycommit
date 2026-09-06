import { act, render } from '@testing-library/react-native'
import { ReviewScreen } from './ReviewScreen'

const mockGoBack = jest.fn()
const mockMonthly = jest.fn()
// 服务对象必须稳定:每次渲染新建会触发 effect 无限重跑
const mockServices = { reviews: { monthly: mockMonthly } }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('../../core/MobileServicesProvider', () => ({
  useMobileServices: () => mockServices,
}))

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function renderReview() {
  const view = render(<ReviewScreen />)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return view
}

describe('ReviewScreen', () => {
  beforeEach(() => {
    mockGoBack.mockClear()
    mockMonthly.mockReset()
  })

  it('装订页按用户时区请求当月统计并展示服务端数据', async () => {
    mockMonthly.mockResolvedValue({
      month: currentMonthKey(),
      timezone: 'Asia/Shanghai',
      paperCount: 12,
      topicCount: 3,
      resolvedCount: 2,
      days: [{ date: `${currentMonthKey()}-05`, count: 1 }],
    })

    const view = await renderReview()

    await view.findByText('学习装订')
    expect(await view.findByLabelText('本月纸页 12')).toBeTruthy()
    expect(mockMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        month: currentMonthKey(),
        timezone: expect.any(String),
      }),
    )
  })
})
