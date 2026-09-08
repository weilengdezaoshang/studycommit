import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { SearchScreen } from './SearchScreen'

const mockGoBack = jest.fn()
const mockNavigate = jest.fn()
const mockQuery = jest.fn()
const mockServices = { search: { query: mockQuery } }

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('../../core/MobileServicesProvider', () => ({
  useMobileServices: () => mockServices,
}))

async function renderSearch() {
  const view = await render(<SearchScreen />)
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return view
}

describe('SearchScreen server search', () => {
  beforeEach(() => {
    mockGoBack.mockClear()
    mockNavigate.mockClear()
    mockQuery.mockReset()
  })

  it('输入关键词后展示云端命中的纸页与箱子并携带查询词', async () => {
    mockQuery.mockResolvedValue({
      papers: {
        items: [
          {
            id: 'b4c9d2e1-1111-4111-8111-111111111111',
            content: '云端纸页:调度器小顶堆',
            status: 'inbox',
            topicId: null,
            version: 1,
            createdAt: '2026-09-05T02:00:00.000Z',
            updatedAt: '2026-09-05T02:00:00.000Z',
            deletedAt: null,
            hasQuestion: false,
            isQuestionResolved: false,
            questionStatus: 'none',
            questionText: null,
            understandingText: null,
            questionResolvedAt: null,
          },
        ],
        pageInfo: { hasNextPage: false, nextCursor: null },
      },
      topics: [
        {
          id: 'b4c9d2e1-2222-4222-8222-222222222222',
          name: '云端箱子',
          paperCount: 2,
        },
      ],
    })

    const view = await renderSearch()
    fireEvent.changeText(view.getByPlaceholderText('搜索记录、疑问或主题'), '小顶堆')

    await view.findByText('云端纸页:调度器小顶堆')
    expect(await view.findByText('云端箱子')).toBeTruthy()
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith({ q: '小顶堆' })
    })
  })

  it('点击云端箱子回首页时间流按箱子筛选', async () => {
    mockQuery.mockResolvedValue({
      papers: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
      topics: [
        {
          id: 'b4c9d2e1-3333-4333-8333-333333333333',
          name: '要筛选的箱子',
          paperCount: 0,
        },
      ],
    })

    const view = await renderSearch()
    fireEvent.changeText(view.getByPlaceholderText('搜索记录、疑问或主题'), '箱子')

    fireEvent.press(await view.findByText('要筛选的箱子'))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Home', {
        selectedTopicId: 'b4c9d2e1-3333-4333-8333-333333333333',
      })
    })
  })
})
