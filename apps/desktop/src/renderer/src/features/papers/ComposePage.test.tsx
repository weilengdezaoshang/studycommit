import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ComposePage } from './ComposePage'

const mockCreatePaper = vi.fn()

vi.mock('./papers-store', () => ({
  papersActions: { createPaper: (...args: unknown[]) => mockCreatePaper(...args) },
}))

const DRAFT_KEY = 'studycommit.desktop.compose-draft.v1'

function renderCompose() {
  return render(
    <MemoryRouter>
      <ComposePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockCreatePaper.mockReset()
  window.localStorage.clear()
})

describe('写记录', () => {
  it('空正文时保存不可用', () => {
    renderCompose()
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('输入正文后草稿防抖落盘,重进自动恢复', async () => {
    const user = userEvent.setup()
    const first = renderCompose()
    await user.type(screen.getByLabelText('正文'), '还没保存的想法')
    await waitFor(() => {
      expect(window.localStorage.getItem(DRAFT_KEY)).toContain('还没保存的想法')
    })
    first.unmount()

    renderCompose()
    expect(await screen.findByLabelText('正文')).toHaveValue('还没保存的想法')
    expect(screen.getByText(/已恢复上次未保存的内容/)).toBeInTheDocument()
  })

  it('保存成功调用创建并清空本地草稿', async () => {
    mockCreatePaper.mockResolvedValue({ id: 'p-1' })
    const user = userEvent.setup()
    renderCompose()
    await user.type(screen.getByLabelText('正文'), '要保存的内容')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(mockCreatePaper).toHaveBeenCalledTimes(1))
    expect(mockCreatePaper.mock.calls[0][0]).toMatchObject({ content: '要保存的内容' })
    await waitFor(() => {
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    })
  })

  it('创建失败时保留草稿并显示错误', async () => {
    mockCreatePaper.mockRejectedValue(new Error('网络不给力'))
    const user = userEvent.setup()
    renderCompose()
    await user.type(screen.getByLabelText('正文'), '要保存的内容')
    await user.click(screen.getByRole('button', { name: '保存' }))

    // Hook 统一保存失败文案,不泄漏原始异常
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请检查网络后重试')
    await waitFor(() => {
      expect(window.localStorage.getItem(DRAFT_KEY)).toContain('要保存的内容')
    })
  })
})
