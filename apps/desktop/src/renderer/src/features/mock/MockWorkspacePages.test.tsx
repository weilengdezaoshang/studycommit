import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MockDraftsPage, MockReviewPage, MockTodayPage, MockTopicsPage } from './MockWorkspacePages'

describe('MockWorkspacePages', () => {
  it('renders only unfiled papers in drafts', () => {
    render(<MockDraftsPage />)
    expect(screen.getByRole('heading', { name: '待整理' })).toBeInTheDocument()
    expect(
      screen.getByText('为什么 React 的状态更新不是立即生效？批处理和调度分别解决了什么问题？'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Safe Area 不只是顶部留白，它代表系统界面与应用内容之间需要共同遵守的边界。',
      ),
    ).not.toBeInTheDocument()
  })

  it('renders unresolved questions separately from filed papers', () => {
    render(<MockReviewPage />)
    expect(screen.getByRole('heading', { name: '还在思考' })).toBeInTheDocument()
    expect(screen.getByText(/2 个未解决问题/)).toBeInTheDocument()
  })

  it('changes the reading pane when selecting another paper', () => {
    render(<MockTodayPage />)
    expect(screen.getByRole('heading', { name: /为什么 React 的状态更新/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Safe Area 不只是顶部留白/ }))
    expect(screen.getByRole('heading', { name: /Safe Area 不只是顶部留白/ })).toBeInTheDocument()
    expect(screen.getByText(/safe-area-inset-top/)).toBeInTheDocument()
    expect(screen.queryByText(/setNumber/)).not.toBeInTheDocument()
  })

  it('shows topic counts and keeps the create action available', () => {
    render(<MockTopicsPage />)
    expect(screen.getByRole('button', { name: '新建箱子' })).toBeInTheDocument()
    expect(screen.getByText('18 张纸页')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '打开箱子' })).toHaveLength(3)
  })
})
