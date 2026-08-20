import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useDialog } from './useDialog'

function Example({ onConfirm = vi.fn() }: { onConfirm?: () => void }) {
  const dialog = useDialog()
  return (
    <>
      <button
        type="button"
        onClick={() =>
          dialog.show({
            title: '确认操作',
            description: '对话框内容',
            cancelLabel: '取消',
            confirmLabel: '确定',
            onConfirm,
          })
        }
      >
        打开
      </button>
      {dialog.dialog}
    </>
  )
}

describe('useDialog', () => {
  it('shows a dialog from hook text and confirms', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Example onConfirm={onConfirm} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '打开' }))
    expect(screen.getByRole('dialog', { name: '确认操作' })).toBeInTheDocument()
    expect(screen.getByText('对话框内容')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the dialog open and shows the error when confirm fails', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error('服务返回了无法识别的数据。'))
    render(<Example onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: '打开' }))
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(screen.getByRole('dialog', { name: '确认操作' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('服务返回了无法识别的数据。')
  })

  it('closes with Escape before confirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Example onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: '打开' }))
    await user.keyboard('{Escape}')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
