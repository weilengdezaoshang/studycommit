import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
  it('陪学关闭时旧小窗地址回到记录本且不读取已有会话', async () => {
    const getActive = vi.spyOn(window.studyCommit.studySessions, 'getActive')
    renderAt('/mini-session')
    expect(await screen.findByRole('heading', { name: '记录本' })).toBeInTheDocument()
    act(() => window.dispatchEvent(new Event('studycommit:open-study')))
    expect(screen.queryByRole('dialog', { name: '学习面板' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /继续学习/ })).not.toBeInTheDocument()
    expect(getActive).not.toHaveBeenCalled()
  })

  it('陪学关闭时旧工作区模式仍显示记录本', async () => {
    render(
      <MemoryRouter initialEntries={['/today']}>
        <AppRoutes workspaceMode="study-session" />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: '记录本' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '开始学习' })).not.toBeInTheDocument()
  })
  it('根路由重定向到上次顶级路径并渲染记录本', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { name: '记录本' })).toBeInTheDocument()
    expect(screen.getByText('StudyCommit')).toBeInTheDocument()
  })

  it('抽屉不再包含旧页面导航,也未暴露计划中的统计', () => {
    renderAt('/today')
    expect(screen.queryByRole('link', { name: '今天' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '草稿' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '学习统计' })).not.toBeInTheDocument()
    expect(screen.getByText('我的主题')).toBeInTheDocument()
  })

  it('shows a recoverable not-found page inside the shell', async () => {
    const user = userEvent.setup()
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { name: '页面不存在', level: 2 })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '返回今天' }))
    expect(await screen.findByRole('heading', { name: '记录本' })).toBeInTheDocument()
  })

  it('抽屉打开时焦点落在搜索入口,键盘可移动到下一个控件', async () => {
    const user = userEvent.setup()
    renderAt('/today')

    expect(screen.getByRole('button', { name: '搜索记录与主题' })).toHaveFocus()
    await user.tab()
    const active = document.activeElement as HTMLElement
    expect(active.className).toContain('drawer-icon-action')
  })

  it('首次加载失败时提供重试且不将种子数据当作缓存', async () => {
    renderAt('/timeline')
    expect(await screen.findByText('记录暂时加载失败')).toBeInTheDocument()
    expect(screen.queryByText(/50 分钟|今日累计/)).not.toBeInTheDocument()
  })

  it('opens and closes the learning drawer without changing the current page', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    const menuButton = screen.getByRole('button', { name: '打开我的抽屉' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('我的主题')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    await user.click(menuButton)
    expect(screen.getByText('我的主题')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: '记录本' })).toBeInTheDocument()
  })

  it('抽屉内的设置入口关闭抽屉并进入设置页', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    await user.click(screen.getByRole('button', { name: '打开我的抽屉' }))

    await user.click(screen.getByRole('button', { name: '个人设置' }))

    expect(screen.getByText('我的空间')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开我的抽屉' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
