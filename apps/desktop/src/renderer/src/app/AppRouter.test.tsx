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
    expect(await screen.findByRole('heading', { name: '纸页时间线' })).toBeInTheDocument()
    expect(screen.getByText('StudyCommit')).toBeInTheDocument()
  })

  it('抽屉不再包含顶部页面导航,也不暴露计划中的统计', () => {
    renderAt('/today')
    expect(screen.queryByRole('link', { name: '今天' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '草稿' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '学习统计' })).not.toBeInTheDocument()
    expect(screen.getByText('我的箱子')).toBeInTheDocument()
  })

  it('shows a recoverable not-found page inside the shell', async () => {
    const user = userEvent.setup()
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { name: '页面不存在', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '返回今天' }))
    expect(screen.getByRole('heading', { name: '纸页时间线' })).toBeInTheDocument()
  })

  it('抽屉打开时焦点落在设置按钮上,键盘可移动到箱子列表', async () => {
    const user = userEvent.setup()
    renderAt('/today')

    expect(screen.getByRole('button', { name: '打开设置' })).toHaveFocus()
    await user.tab()
    const active = document.activeElement as HTMLElement
    expect(active.className).toContain('drawer-link')
  })

  it('renders mock topic data without legacy business metrics', () => {
    renderAt('/topics')
    expect(screen.getAllByText('我的箱子').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/50 分钟|今日累计/)).not.toBeInTheDocument()
  })

  it('opens and closes the learning drawer without changing the current page', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    const menuButton = screen.getByRole('button', { name: '打开学习抽屉' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('我的箱子')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    await user.click(menuButton)
    expect(screen.getByText('我的箱子')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: '纸页时间线' })).toBeInTheDocument()
  })

  it('抽屉内的设置按钮关闭抽屉并进入设置页', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    await user.click(screen.getByRole('button', { name: '打开学习抽屉' }))

    await user.click(screen.getByRole('button', { name: '打开设置' }))

    expect(screen.getByText('账户')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开学习抽屉' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
