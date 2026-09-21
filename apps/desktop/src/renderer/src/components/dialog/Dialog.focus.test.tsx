import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

describe('弹窗键盘边界', () => {
  it('焦点在弹窗内循环且忙碌期间不响应退出', async () => {
    const user = userEvent.setup()
    const close = vi.fn()
    const { rerender } = render(
      <Dialog open title="编辑" onClose={close}>
        <button>第一个</button>
        <button>最后一个</button>
      </Dialog>,
    )
    expect(screen.getByText('第一个')).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByText('最后一个')).toHaveFocus()
    await user.tab()
    expect(screen.getByText('第一个')).toHaveFocus()
    rerender(
      <Dialog open busy title="编辑" onClose={close}>
        <button>第一个</button>
        <button>最后一个</button>
      </Dialog>,
    )
    await user.keyboard('{Escape}')
    expect(close).not.toHaveBeenCalled()
  })
})
