import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { AgentScreen } from './AgentScreen'
import { buildSeedPapers } from '../../features/papers/mock-data'

const mockPaper = buildSeedPapers()[0]
const mockQuote = jest.fn()
const mockStartRun = jest.fn()
const mockGetRun = jest.fn()
const mockConfirm = jest.fn()
const mockGoBack = jest.fn()
const mockServices = {
  ai: {
    quote: mockQuote,
    explainRun: mockStartRun,
    getRun: mockGetRun,
    confirmPaperExplain: mockConfirm,
  },
}

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { paperId: mockPaper.id } }),
  useNavigation: () => ({ goBack: mockGoBack }),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}))
jest.mock('../../core/MobileServicesProvider', () => ({ useMobileServices: () => mockServices }))
jest.mock('../../features/papers/papers-store', () => ({
  usePapersState: () => ({ papers: [mockPaper], topics: [] }),
  papersActions: { markQuestionConfirmed: jest.fn() },
}))
const explanation = {
  runId: 'run',
  view: { type: 'definition_counterexample', definition: '保留的解释', counterexample: '反例' },
  example: '例子',
  plainLevel: 1,
  model: 'fake',
  promptVersion: 'paper-explain@1',
}
const completedRun = {
  runId: 'run',
  status: 'completed',
  runPhase: 'completed',
  output: explanation,
  error: null,
  settlement: { state: 'settled', credits: 5 },
  balance: { available: 15, reserved: 0 },
}

describe('AgentScreen', () => {
  beforeEach(() => {
    mockQuote.mockReset()
    mockStartRun.mockReset()
    mockGetRun.mockReset()
    mockConfirm.mockReset()
    mockGoBack.mockClear()
    mockQuote.mockResolvedValue({
      action: 'paper_explain',
      priceCredits: 5,
      priceVersion: 1,
      balance: { available: 20, reserved: 0 },
    })
    mockStartRun.mockResolvedValue({
      runId: 'run',
      runPhase: 'queued',
      priceCredits: 5,
      priceVersion: 1,
      reservedCredits: 5,
      deadlineAt: new Date(Date.now() + 60_000).toISOString(),
    })
    mockGetRun.mockResolvedValue(completedRun)
  })

  const renderAndGenerate = async () => {
    const view = await render(<AgentScreen />)
    await waitFor(() => expect(view.getByText(/生成这张解释卡将消耗 5 积分/)).toBeOnTheScreen())
    await act(async () => {
      fireEvent.press(view.getByLabelText(`生成解释（消耗 ${'5'} 积分）`))
    })
    await waitFor(() => expect(view.getByText('保留的解释')).toBeOnTheScreen())
    return view
  }

  it('未点击生成前不发起任何计费请求', async () => {
    const view = await render(<AgentScreen />)
    await waitFor(() => expect(view.getByText(/生成这张解释卡将消耗 5 积分/)).toBeOnTheScreen())
    expect(mockStartRun).not.toHaveBeenCalled()
    expect(mockGetRun).not.toHaveBeenCalled()
  })

  it('点击生成后受理并展示解释卡', async () => {
    const view = await renderAndGenerate()
    expect(mockStartRun).toHaveBeenCalledTimes(1)
    expect(view.getByText('保留的解释')).toBeOnTheScreen()
  })

  it('换一种说法失败时保留原解释和轮次', async () => {
    const view = await renderAndGenerate()
    mockStartRun.mockRejectedValue(new Error('offline'))
    await act(async () => {
      view
        .getByLabelText('解释卡')
        .props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } })
    })
    await waitFor(() => expect(view.getByText(/offline|受理失败/)).toBeOnTheScreen())
    expect(view.getByText('保留的解释')).toBeOnTheScreen()
    expect(view.queryByText('AI 解释 · 第 1 步，共 3 步')).toBeNull()
  })

  it('确认失败时保留解释卡且不返回详情', async () => {
    const view = await renderAndGenerate()
    mockConfirm.mockRejectedValue(new Error('offline'))
    await act(async () => {
      view
        .getByLabelText('解释卡')
        .props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } })
    })
    await waitFor(() =>
      expect(view.getByText('确认失败，当前解释和问题状态已保留，请重试。')).toBeOnTheScreen(),
    )
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it('回看辅助操作仅展示已读解释且不会确认理解', async () => {
    const view = await renderAndGenerate()
    expect(view.queryByText('收起回看')).toBeNull()
    await act(async () => {
      view
        .getByLabelText('解释卡')
        .props.onAccessibilityAction({ nativeEvent: { actionName: 'history' } })
    })
    expect(view.getByText('第 1 种解释')).toBeOnTheScreen()
    expect(view.queryByText('第 2 种解释')).toBeNull()
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
