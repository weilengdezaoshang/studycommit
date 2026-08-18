import { render, screen, userEvent } from '@testing-library/react-native'
import App from '../src/App'

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_STUDYCOMMIT_API_ORIGIN = 'http://127.0.0.1:3000'
  globalThis.fetch = jest.fn(async (input: URL | RequestInfo) => {
    const url = String(input)
    if (url.includes('/study-sessions/active')) {
      return jsonResponse({ session: null, serverNow: '2026-08-17T08:00:00.000Z' })
    }
    if (url.includes('/topics')) {
      return jsonResponse({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } })
    }
    return jsonResponse({ message: 'not found' }, 404)
  })
})

describe('<App />', () => {
  it('renders the real app provider composition', async () => {
    await render(<App />)

    expect(await screen.findByText('今天，从一次专注开始')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: '开始学习' })).toBeOnTheScreen()
    expect(screen.getByLabelText('今天，标签页').props.accessibilityState).toEqual({
      selected: true,
    })
    expect(screen.getByLabelText('专题，标签页').props.accessibilityState).toEqual({
      selected: false,
    })
    expect(screen.queryByText('应用暂时无法显示')).not.toBeOnTheScreen()
  })

  it('switches between all primary modules', async () => {
    await render(<App />)
    const user = userEvent.setup()

    await user.press(screen.getByLabelText('专题，标签页'))
    expect(screen.getByText('整理你的知识专题')).toBeOnTheScreen()

    await user.press(screen.getByLabelText('记录，标签页'))
    expect(screen.getByText('留下可追溯的学习记录')).toBeOnTheScreen()

    await user.press(screen.getByLabelText('复习，标签页'))
    expect(screen.getByText('把学过的内容真正记住')).toBeOnTheScreen()

    await user.press(screen.getByLabelText('今天，标签页'))
    expect(await screen.findByText('今天，从一次专注开始')).toBeOnTheScreen()
  })

  it('opens Profile from the header avatar', async () => {
    await render(<App />)
    const user = userEvent.setup()

    await user.press(screen.getByRole('button', { name: '打开我的' }))

    expect(screen.getByText('我的 StudyCommit')).toBeOnTheScreen()
  })
})
