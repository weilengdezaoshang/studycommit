import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { SearchPage } from './SearchPage'

vi.mock('../papers/papers-store', () => ({ usePapersState: () => ({ papers: [], topics: [] }) }))
const empty = {
  papers: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
  topics: [],
}
function show() {
  return render(
    <MemoryRouter>
      <SearchPage />
    </MemoryRouter>,
  )
}

describe('SearchPage', () => {
  it('初始展示搜索引导且限制关键词长度', () => {
    show()
    expect(screen.getByRole('heading', { name: '找回一点想法' })).toBeVisible()
    expect(screen.getByText('从一个关键词开始')).toBeVisible()
    expect(screen.getByLabelText('搜索记录')).toHaveAttribute('maxlength', '50')
    expect(screen.queryByText('这次还没翻到')).not.toBeInTheDocument()
  })
  it('等待请求时显示加载状态而不是空结果', async () => {
    vi.spyOn(window.studyCommit.search, 'query').mockImplementation(() => new Promise(() => {}))
    show()
    await userEvent.type(screen.getByLabelText('搜索记录'), '关键词')
    expect(screen.getByText('正在搜索云端记录，本机结果先显示…')).toBeVisible()
    expect(screen.queryByText('这次还没翻到')).not.toBeInTheDocument()
  })
  it('无结果时允许清空并返回初始引导', async () => {
    vi.spyOn(window.studyCommit.search, 'query').mockResolvedValue({ ok: true, data: empty })
    show()
    await userEvent.type(screen.getByLabelText('搜索记录'), '不存在')
    expect(await screen.findByText('这次还没翻到')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '清除关键词' }))
    expect(screen.getByText('从一个关键词开始')).toBeVisible()
  })
  it('云端失败时明确标注本机回退范围', async () => {
    vi.spyOn(window.studyCommit.search, 'query').mockRejectedValue(new Error('offline'))
    show()
    await userEvent.type(screen.getByLabelText('搜索记录'), '测试')
    expect(await screen.findByText('本机暂时没有找到')).toBeVisible()
    expect(screen.getByText(/云端搜索不可用/)).toBeVisible()
  })
  it('修改关键词后不再展示上次主题结果', async () => {
    const query = vi.spyOn(window.studyCommit.search, 'query').mockResolvedValue({
      ok: true,
      data: { ...empty, topics: [{ id: 'a', name: '旧主题', paperCount: 2 }] },
    })
    show()
    const input = screen.getByLabelText('搜索记录')
    await userEvent.type(input, '旧')
    expect(await screen.findByRole('link', { name: /旧主题/ })).toBeVisible()
    query.mockImplementation(() => new Promise(() => {}))
    await userEvent.clear(input)
    await userEvent.type(input, '新')
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /旧主题/ })).not.toBeInTheDocument(),
    )
    expect(screen.getByText('正在搜索云端记录，本机结果先显示…')).toBeVisible()
  })
})
