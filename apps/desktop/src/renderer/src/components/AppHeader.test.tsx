import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('点击品牌标识返回记录本且顶栏不重复展示工具入口', async () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <AppHeader drawerOpen={false} onMenu={() => {}} />
        <Routes>
          <Route path="/search" element={<p>搜索页</p>} />
          <Route path="/timeline" element={<h1>记录本</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    const header = within(screen.getByRole('banner'))
    expect(header.queryByLabelText('搜索记录与主题')).not.toBeInTheDocument()
    expect(header.queryByLabelText('个人设置')).not.toBeInTheDocument()
    expect(header.getByRole('status')).toBeInTheDocument()
    await userEvent.click(header.getByRole('link', { name: 'StudyCommit，返回记录本' }))
    expect(screen.getByRole('heading', { name: '记录本' })).toBeVisible()
  })
  it('保留打开抽屉的操作', async () => {
    const onMenu = vi.fn()
    render(
      <MemoryRouter>
        <AppHeader drawerOpen={false} onMenu={onMenu} />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: '打开我的抽屉' }))
    expect(onMenu).toHaveBeenCalledOnce()
  })
})
