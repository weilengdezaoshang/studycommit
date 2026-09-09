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

function openDrawer() {
  return screen.getByRole('button', { name: '打开我的抽屉' })
}

describe('drawer wiring', () => {
  it('点击主题后进入该主题的纸页并关闭抽屉', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    await user.click(openDrawer())
    await user.click(screen.getByRole('button', { name: '打开移动端设计主题' }))

    expect(openDrawer()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByText('移动端设计').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Safe Area 不只是顶部留白/).length).toBeGreaterThanOrEqual(1)
  })

  it('点击待整理进入待整理页', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    await user.click(openDrawer())
    await user.click(screen.getByRole('button', { name: /待整理/ }))

    expect(screen.getAllByText('待整理的纸页').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/React 的状态更新/).length).toBeGreaterThanOrEqual(1)
  })

  it('点击还在思考进入问题页', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    await user.click(openDrawer())
    await user.click(screen.getByRole('button', { name: /还在思考/ }))

    expect(await screen.findByText(/暂时没有记下的问题|Safe Area/)).toBeInTheDocument()
    expect(document.querySelector('.collection--questions')).not.toBeNull()
  })

  it('抽屉点选日期后记录本只看当天,并可清除日期', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    // 种子数据:昨天只有 Safe Area 一张纸页
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dayLabel = `${yesterday.getFullYear()}年${yesterday.getMonth() + 1}月${yesterday.getDate()}日，1 条记录`

    await user.click(openDrawer())
    await user.click(screen.getByRole('button', { name: dayLabel }))

    // 只剩选中日期的记录组,并出现清除日期入口
    expect(screen.getByText(/· 1 条记录/)).toBeInTheDocument()
    expect(screen.queryAllByText(/React 的状态更新/)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '清除日期' }))
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)
  })

  it('单击记录卡片在右侧阅读与思考栏打开全文', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    const card = await screen.findByRole('button', { name: /打开记录：.*React 的状态更新/ })
    expect(screen.queryByRole('complementary', { name: '阅读与思考' })).not.toBeInTheDocument()
    await user.click(card)

    const reader = screen.getByRole('complementary', { name: '阅读与思考' })
    expect(reader).toHaveTextContent(/React 的状态更新/)
    expect(reader).toHaveTextContent('整理与更多')
  })

  it('阅读栏内整理与更多展开后可归入主题', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    const card = await screen.findByRole('button', { name: /打开记录：.*React 的状态更新/ })
    await user.click(card)

    const reader = screen.getByRole('complementary', { name: '阅读与思考' })
    await user.click(within(reader).getByText('整理与更多'))
    await user.selectOptions(
      within(reader).getByLabelText(/收纳到主题|给这张纸页找个归属/),
      'topic-mobile',
    )
    await user.click(within(reader).getByRole('button', { name: '归入主题' }))

    expect(await screen.findByText(/纸页已归入「移动端设计」/)).toBeInTheDocument()
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
