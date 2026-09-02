import { fireEvent, render, screen } from '@testing-library/react-native'
import { PaperCollection } from '../src/screens/collection/CollectionScreen'

const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: jest.fn(),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }))
jest.mock('../src/features/papers/papers-store', () => ({
  usePapersState: () => ({
    topics: [{ id: 'box', name: '学习箱子' }],
    papers: [
      {
        id: 'one',
        content: '还想弄懂闭包',
        status: 'inbox',
        topicId: null,
        createdAt: '2026-08-31T09:00:00Z',
        deletedAt: null,
      },
      {
        id: 'two',
        content: '理解了作用域',
        status: 'organized',
        topicId: 'box',
        createdAt: '2026-08-30T09:00:00Z',
        deletedAt: null,
      },
    ],
    extras: {
      one: { hasQuestion: true, isQuestionResolved: false },
      two: { hasQuestion: true, isQuestionResolved: true },
    },
  }),
}))

describe('移动端纸页集合', () => {
  it('待整理页面只显示未归档纸页并能打开对应详情', async () => {
    await render(<PaperCollection mode="inbox" />)
    expect(screen.getByText('还想弄懂闭包')).toBeOnTheScreen()
    expect(screen.queryByText('理解了作用域')).toBeNull()
    await fireEvent.press(screen.getByLabelText('还想弄懂闭包，还在思考，查看纸页'))
    expect(mockNavigate).toHaveBeenCalledWith('PaperDetail', { paperId: 'one' })
  })
  it('切换已经弄懂后展示已解决问题并支持搜索空状态', async () => {
    await render(<PaperCollection mode="questions" />)
    await fireEvent.press(screen.getByText('已经弄懂'))
    expect(screen.getByText('理解了作用域')).toBeOnTheScreen()
    expect(screen.queryByText('还想弄懂闭包')).toBeNull()
    await fireEvent.changeText(screen.getByLabelText('搜索当前页面的纸页'), '没有匹配')
    expect(screen.getByText('没有符合条件的纸页')).toBeOnTheScreen()
  })
})
