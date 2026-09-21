import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './AppRouter'
import { mockRemoteRecords } from '../test/records-fixture'

function renderAt(path: string) {
  mockRemoteRecords()
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

    expect(screen.getByRole('heading', { name: '待整理', level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/React 的状态更新/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText(/Safe Area 不只是顶部留白/)).toHaveLength(0)
  })

  it('点击还在思考进入问题页', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)

    await user.click(openDrawer())
    await user.click(screen.getByRole('button', { name: /还在思考/ }))

    expect(screen.getByRole('heading', { name: '还在思考', level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/Safe Area|React 的状态更新/).length).toBeGreaterThanOrEqual(1)
    // 无疑问的纸页不进入该范围
    expect(screen.queryAllByText(/闭包会保留创建时的词法作用域/)).toHaveLength(0)
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
    expect(screen.getByText('1 条记录')).toBeInTheDocument()
    expect(screen.queryAllByText(/React 的状态更新/)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: /清除日期/ }))
    expect((await screen.findAllByText(/React 的状态更新/)).length).toBeGreaterThanOrEqual(1)
  })

  it('单击记录卡片进入完整详情并显示独立整理区域', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    const card = await screen.findByRole('button', { name: /打开记录：.*React 的状态更新/ })
    expect(screen.queryByRole('complementary', { name: '阅读与思考' })).not.toBeInTheDocument()
    await user.click(card)

    const reader = await screen.findByRole('article', { name: '阅读与思考' })
    expect(reader).toHaveTextContent(/React 的状态更新/)
    expect(reader).toHaveTextContent('整理这条记录')
  })

  it('详情的独立整理区域可归入主题', async () => {
    const user = userEvent.setup()
    renderAt('/timeline')
    const card = await screen.findByRole('button', { name: /打开记录：.*React 的状态更新/ })
    await user.click(card)

    const reader = await screen.findByRole('article', { name: '阅读与思考' })
    await user.click(within(reader).getByLabelText(/所属主题/))
    await user.click(screen.getByRole('option', { name: '移动端设计' }))
    await user.click(within(reader).getByRole('button', { name: /归入主题/ }))

    expect(await screen.findByText('记录已归入主题')).toBeInTheDocument()
  })

  it('日历通过公共下拉选择年份和月份并立即更新', async () => {
    const user = userEvent.setup()
    renderAt('/today')
    await user.click(screen.getByRole('combobox', { name: '选择年份' }))
    expect(document.querySelector('.dropdown-select-menu')).not.toBeNull()
    await user.click(screen.getByRole('option', { name: '2024 年' }))
    await user.click(screen.getByRole('combobox', { name: '选择月份' }))
    await user.click(screen.getByRole('option', { name: '2 月' }))
    expect(screen.getByLabelText('2024 年 2 月学习记录热力图')).toBeInTheDocument()
  })
})
