import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from 'antd'
import ArtworksPage from './index'
import ArtworkEditPage from './Edit'
import { artworkApi, type Artwork } from '@/services/artworks'
vi.mock('@/services/artworks', () => ({
  artworkApi: { list: vi.fn(), assets: vi.fn(), save: vi.fn(), transition: vi.fn() },
  artworkImage: (key: string) => `/api/puzzles/assets/${key}`,
}))
vi.mock('@/components/AdminPage', () => ({
  AdminPage: ({
    title,
    extra,
    children,
  }: {
    title: React.ReactNode
    extra: React.ReactNode
    children: React.ReactNode
  }) => (
    <main>
      {title}
      {extra}
      {children}
    </main>
  ),
}))
const artwork: Artwork = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'spring-rabbit',
  title: '春日来信',
  description: '',
  assetKey: 'spring-rabbit',
  style: '水彩',
  sortOrder: 1,
  status: 'draft',
  pieceCount: 12,
  version: 1,
  updatedAt: '',
  hasRewards: false,
}
function mount(node: React.ReactNode) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cache}>
      <App>{node}</App>
    </QueryClientProvider>,
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe('画作管理', () => {
  it('搜索后只展示匹配画作', async () => {
    vi.mocked(artworkApi.list).mockResolvedValue({
      items: [artwork, { ...artwork, id: 'b', title: '海边慢读' }],
    })
    mount(<ArtworksPage />)
    await screen.findByText('海边慢读')
    fireEvent.change(screen.getByLabelText('搜索画作名称'), { target: { value: '春日' } })
    expect(screen.queryByText('海边慢读')).toBeNull()
    expect(screen.getByText('春日来信')).toBeTruthy()
  })
  it('已发布画作只读并提供下架操作', async () => {
    vi.mocked(artworkApi.list).mockResolvedValue({ items: [{ ...artwork, status: 'published' }] })
    vi.mocked(artworkApi.assets).mockResolvedValue({ items: [] })
    mount(<ArtworkEditPage />)
    await screen.findByText('下架画作')
    expect((screen.getByLabelText('画作名称') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByText('保存草稿')).toBeNull()
  })
  it('发布必须填写原因且取消不会调用接口', async () => {
    vi.mocked(artworkApi.list).mockResolvedValue({ items: [artwork] })
    vi.mocked(artworkApi.assets).mockResolvedValue({ items: [] })
    mount(<ArtworkEditPage />)
    await screen.findByDisplayValue('春日来信')
    fireEvent.click(screen.getByRole('button', { name: '发布画作' }))
    const confirm = await screen.findByRole('button', { name: /确.*认/ })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /取.*消/ }))
    expect(artworkApi.transition).not.toHaveBeenCalled()
  })
})
