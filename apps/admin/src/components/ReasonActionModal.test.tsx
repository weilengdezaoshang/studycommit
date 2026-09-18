import { App, ConfigProvider } from 'antd'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReasonActionModal } from './ReasonActionModal'

afterEach(() => cleanup())

function wrap(node: ReactNode) {
  return render(
    <ConfigProvider button={{ autoInsertSpace: false }}>
      <App>{node}</App>
    </ConfigProvider>,
  )
}

describe('ReasonActionModal', () => {
  it('理由为空时禁用确认，忙碌时不可关闭', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    wrap(
      <ReasonActionModal
        open
        title="确认发布活动？"
        confirmText="确认发布"
        reasonLabel="发布原因"
        busy
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    )
    const confirm = screen.getByRole('button', { name: /确认发布/ }) as HTMLButtonElement
    const cancel = screen.getByRole('button', { name: /取消/ }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    fireEvent.click(cancel)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('结果未知时改为查询结果，不提供再次发放', () => {
    const onQuery = vi.fn()
    wrap(
      <ReasonActionModal
        open
        title="补偿待处理领取"
        confirmText="确认补偿"
        reasonLabel="补偿理由"
        unknownText="补偿结果待确认。请先查询原领取状态，不要再次发放。"
        onSubmit={vi.fn()}
        onQueryResult={onQuery}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: '确认补偿' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '查询结果' }))
    expect(onQuery).toHaveBeenCalled()
  })

  it('409 冲突时保留已输入理由', () => {
    wrap(
      <ReasonActionModal
        open
        title="确认发布活动？"
        confirmText="确认发布"
        reasonLabel="发布原因"
        conflictText="当前版本 v3，最新版本 v4"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const textarea = screen.getByPlaceholderText('请输入操作理由') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '保留这次发布理由' } })
    expect(textarea.value).toBe('保留这次发布理由')
    expect(screen.getByText('内容已更新')).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看最新' }) as HTMLButtonElement).toBeTruthy()
    expect(screen.queryByRole('button', { name: '确认发布' })).toBeNull()
  })
})
