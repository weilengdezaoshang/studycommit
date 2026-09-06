import { fireEvent, render, screen, within } from '@testing-library/react'
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

function recordsPage() {
  const node = document.querySelector('.collection')
  expect(node).not.toBeNull()
  return within(node as HTMLElement)
}

describe('drawer wiring', () => {
  it('点击箱子后筛选首页时间轴并关闭抽屉', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: '打开学习抽屉' }))
    await user.click(screen.getByRole('button', { name: '打开移动端设计箱子' }))

    expect(screen.getByRole('button', { name: '打开学习抽屉' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getAllByText('移动端设计').length).toBeGreaterThanOrEqual(1)
    expect(recordsPage().getAllByText(/Safe Area 不只是顶部留白/).length).toBeGreaterThanOrEqual(1)
    expect(recordsPage().queryAllByText(/React 的状态更新/)).toHaveLength(0)
  })

  it('点击待整理的纸页筛选 inbox 记录', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: '打开学习抽屉' }))
    await user.click(screen.getByRole('button', { name: /待整理的纸页/ }))

    expect(screen.getAllByText('待整理的纸页').length).toBeGreaterThanOrEqual(1)
    expect(recordsPage().getAllByText(/React 的状态更新/).length).toBeGreaterThanOrEqual(1)
    expect(recordsPage().queryAllByText(/Safe Area 不只是顶部留白/)).toHaveLength(0)
  })

  it('点击还在思考的问题进入问题页', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: '打开学习抽屉' }))
    await user.click(screen.getByRole('button', { name: /还在思考的问题/ }))

    expect(await screen.findByText(/暂时没有记下的问题|Safe Area/)).toBeInTheDocument()
    expect(document.querySelector('.collection--questions')).not.toBeNull()
  })

  it('单击时间线卡片在右侧阅读器直接打开全文', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    // 时间线展示选中日期(默认今天)的纸页;种子数据今天只有 React 那张
    const card = await screen.findByRole('button', { name: /React 的状态更新/ })
    expect(screen.getByRole('complementary', { name: '纸页阅读器' })).toHaveTextContent(
      '点左侧任意一张纸页',
    )
    await user.click(card)

    const reader = screen.getByRole('complementary', { name: '纸页阅读器' })
    expect(reader).toHaveTextContent(/React 的状态更新/)
    expect(reader).toHaveTextContent('归入箱子')
    // 地址未发生变化,仍在时间线页
    expect(document.querySelector('.collection')).toBeNull()
  })

  it('时间线卡片的查看当天入口进入当日记录页', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    const card = await screen.findByRole('button', { name: /React 的状态更新/ })
    await user.click(within(card).getByText('查看当天'))

    expect(document.querySelector('.collection--date')).not.toBeNull()
    expect(screen.getAllByText(/React 的状态更新/).length).toBeGreaterThanOrEqual(1)
  })

  it('时间线键盘向下移动选中并直读,再次回车进入沉浸详情', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    const card = await screen.findByRole('button', { name: /React 的状态更新/ })
    card.focus()
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('complementary', { name: '纸页阅读器' }).textContent).toContain(
      'React 的状态更新',
    )

    await user.keyboard('{Enter}')
    expect(document.querySelector('.collection-detail')).not.toBeNull()
  })

  it('滚轮滚动后预览跟随滚动位置', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    await user.click(screen.getByRole('button', { name: '选择年月' }))

    const yearColumn = document.querySelector<HTMLDivElement>('.wheel-column[aria-label="年份"]')
    expect(yearColumn).not.toBeNull()
    yearColumn!.scrollTop = 120
    fireEvent.scroll(yearColumn!)

    expect(screen.getByText(/1903 年 \d+ 月/)).toBeInTheDocument()
  })
})
