import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PuzzleModal from './PuzzleModal'
import { papersActions } from '../papers/papers-store'
const mockInject = jest.fn()
const mockAccount = { session: { user: { id: 'alice' } } }
jest.mock('../../infrastructure/auth/session-store', () => ({ getAuthGate: () => mockAccount }))
const mockPuzzles = {
  album: jest
    .fn()
    .mockResolvedValue({ artworks: [], selectedArtworkId: null, credit: 0, rewards: [] }),
  selectArtwork: jest.fn(),
  reveal: jest.fn(),
}
jest.mock('../../core/MobileServicesProvider', () => ({
  useMobileServices: () => ({ puzzles: mockPuzzles }),
}))
jest.mock('@studycommit/puzzle-ui/mobile-bundle', () => ({ puzzleHtml: '<html>本地画册</html>' }))
jest.mock('../papers/papers-store', () => ({
  usePapersState: () => ({
    papers: [{ id: 'p', status: 'inbox', createdAt: '2020-01-01T00:00:00Z', content: '旧记录' }],
    topics: [{ id: 't', name: '主题' }],
  }),
  papersActions: { organizePaper: jest.fn().mockResolvedValue({ id: 'p' }) },
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    WebView: React.forwardRef<{ injectJavaScript: typeof mockInject }, object>(
      function MockWebView(props, ref) {
        React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }))
        return React.createElement(View, { ...props, testID: 'puzzle-webview' })
      },
    ),
  }
})
beforeEach(() => {
  mockInject.mockClear()
  mockAccount.session.user.id = 'alice'
  jest.clearAllMocks()
})
describe('PuzzleModal', () => {
  it('按账号和奖励保存并读取刮痕', async () => {
    const view = await render(<PuzzleModal account="alice" onClose={jest.fn()} />)
    const strokes = [{ x: 0.25, y: 0.5 }]
    await fireEvent(view.getByTestId('puzzle-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'request',
          id: 1,
          method: 'saveStrokes',
          args: ['reward-1', strokes],
        }),
      },
    })
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'studycommit.puzzle.strokes.v1.alice.reward-1',
        JSON.stringify(strokes),
      ),
    )
    await fireEvent(view.getByTestId('puzzle-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'request',
          id: 2,
          method: 'loadStrokes',
          args: ['reward-1'],
        }),
      },
    })
    await waitFor(() =>
      expect(mockInject).toHaveBeenCalledWith(expect.stringContaining('"x":0.25')),
    )
  })
  it('账号变化后拒绝旧画册发起的整理请求', async () => {
    const view = await render(<PuzzleModal account="alice" onClose={jest.fn()} />)
    mockAccount.session.user.id = 'bob'
    await fireEvent(view.getByTestId('puzzle-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'request', id: 3, method: 'organize', args: ['p', 't'] }),
      },
    })
    expect(papersActions.organizePaper).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(mockInject).toHaveBeenCalledWith(expect.stringContaining('登录状态已变化')),
    )
  })
  it('不允许画册跳转外部网页且未知消息不会触发请求', async () => {
    const view = await render(<PuzzleModal account="alice" onClose={jest.fn()} />)
    const web = view.getByTestId('puzzle-webview')
    expect(web.props.onShouldStartLoadWithRequest({ url: 'https://example.com' })).toBe(false)
    await fireEvent(web, 'message', { nativeEvent: { data: 'null' } })
    expect(papersActions.organizePaper).not.toHaveBeenCalled()
  })
})
