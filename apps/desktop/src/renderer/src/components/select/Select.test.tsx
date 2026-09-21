import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

describe('Select', () => {
  it('选择前显示占位文字并在选择后回传选项值', async () => {
    const onChange = vi.fn()
    render(
      <Select label="专题" onValueChange={onChange} placeholder="请选择专题" value="">
        <option value="topic-1">Electron 架构</option>
      </Select>,
    )
    expect(screen.getByLabelText('专题')).toHaveTextContent('请选择专题')
    await userEvent.click(screen.getByLabelText('专题'))
    await userEvent.click(screen.getByRole('option', { name: 'Electron 架构' }))
    expect(onChange).toHaveBeenCalledWith('topic-1')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
  it('键盘跳过禁用选项并通过回车确认', async () => {
    const onValueChange = vi.fn()
    render(
      <Select label="专题" value="a" onValueChange={onValueChange}>
        <option value="a">主题甲</option>
        <option value="b" disabled>
          主题乙
        </option>
        <option value="c">主题丙</option>
      </Select>,
    )
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onValueChange).toHaveBeenCalledWith('c')
    expect(screen.getByRole('combobox')).toHaveFocus()
  })
  it('按退出键或点击外部关闭菜单且不修改选项', async () => {
    const onValueChange = vi.fn()
    render(
      <Select label="专题" value="a" onValueChange={onValueChange}>
        <option value="a">主题甲</option>
      </Select>,
    )
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onValueChange).not.toHaveBeenCalled()
  })
  it('空选项展示空状态且禁用时无法展开', async () => {
    const { rerender } = render(<Select label="专题">{[]}</Select>)
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('暂无可选项')).toBeVisible()
    rerender(
      <Select label="专题" disabled>
        {[]}
      </Select>,
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
