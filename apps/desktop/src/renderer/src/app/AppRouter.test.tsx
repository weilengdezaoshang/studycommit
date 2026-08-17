import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './AppRouter'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('application shell', () => {
  it('redirects the root route to Today and renders the shell', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: '今天' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.getByText('StudyCommit')).toBeInTheDocument()
  })

  it('shows enabled navigation without exposing planned statistics', () => {
    renderAt('/today')
    for (const name of ['今天', '草稿', '所有专题', '复习', '设置']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: '学习统计' })).not.toBeInTheDocument()
  })

  it('navigates between top-level pages and derives active state from the URL', async () => {
    const user = userEvent.setup()
    renderAt('/today')

    await user.click(screen.getByRole('link', { name: '草稿' }))
    expect(screen.getByRole('heading', { name: '草稿' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '草稿' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '今天' })).not.toHaveAttribute('aria-current')
  })

  it('keeps the topic id while navigating between topic sections', async () => {
    const user = userEvent.setup()
    renderAt('/topics/topic-1/overview')

    await user.click(screen.getByRole('link', { name: '知识地图' }))
    expect(screen.getByRole('heading', { name: '知识地图' })).toBeInTheDocument()
    expect(screen.getByText('topic-1')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '学习记录' }))
    expect(screen.getByRole('heading', { name: '学习记录' })).toBeInTheDocument()
    expect(screen.getByText('topic-1')).toBeInTheDocument()
  })

  it('opens a topic at its last valid section', async () => {
    window.localStorage.setItem(
      'studycommit:navigation:v1',
      JSON.stringify({
        version: 1,
        lastTopLevelPath: '/topics',
        lastTopicSectionById: { 'topic-1': 'map' },
      }),
    )
    renderAt('/topics/topic-1')
    expect(await screen.findByRole('heading', { name: '知识地图' })).toBeInTheDocument()
  })

  it('returns a directly opened note to its safe topic notes page', async () => {
    const user = userEvent.setup()
    renderAt('/topics/topic-1/notes/note-1')
    await user.click(screen.getByRole('button', { name: '返回笔记列表' }))
    expect(screen.getByRole('heading', { name: '专题笔记' })).toBeInTheDocument()
  })

  it('shows a recoverable not-found page inside the shell', async () => {
    const user = userEvent.setup()
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { name: '页面不存在', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '返回今天' }))
    expect(screen.getByRole('heading', { name: '今天' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '今天' })).toHaveAttribute('aria-current', 'page')
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    renderAt('/today')

    await user.tab()
    expect(screen.getByRole('link', { name: '今天' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: '草稿' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('heading', { name: '草稿' })).toBeInTheDocument()
  })

  it('does not present sample business metrics on placeholder pages', () => {
    renderAt('/topics')
    expect(screen.getByText('还没有专题')).toBeInTheDocument()
    expect(screen.queryByText(/50 分钟|8 张|今日累计/)).not.toBeInTheDocument()
  })
})
