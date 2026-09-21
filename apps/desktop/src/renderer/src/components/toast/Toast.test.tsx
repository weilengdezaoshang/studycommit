import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '@studycommit/common/toast-react'
import { Toast } from './Toast'

/** 测试探针:把 ToastApi 暴露给用例驱动。 */
let probe: ReturnType<typeof useToast> | null = null
function Probe({ onReady }: { onReady: (api: ReturnType<typeof useToast>) => void }) {
  const api = useToast()
  useEffect(() => {
    onReady(api)
  }, [api, onReady])
  return null
}

function renderToast() {
  return render(
    <ToastProvider renderToast={(toast) => <Toast {...toast} />}>
      <Probe onReady={(api) => (probe = api)} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  probe = null
})

describe('桌面 Toast', () => {
  it('按类型渲染对应的状态图标与样式类', () => {
    renderToast()
    act(() => {
      probe!.show({ message: '已归入箱子', type: 'success' })
    })
    expect(screen.getByRole('status')).toHaveClass('toast--success')

    act(() => {
      probe!.show({ message: '保存失败', type: 'error' })
    })
    expect(screen.getByRole('status')).toHaveClass('toast--error')
    expect(screen.getByText('!')).toBeInTheDocument()
  })

  it('同一文案连续弹出时合并为一条并显示 ×N 计数', () => {
    renderToast()
    // 每次 show 之间让 React 提交状态,provider 才能识别为同一文案
    act(() => {
      probe!.show('稍后再试')
    })
    act(() => {
      probe!.show('稍后再试')
    })
    act(() => {
      probe!.show('稍后再试')
    })
    expect(screen.getByText('×3')).toBeInTheDocument()
    expect(screen.getByText('稍后再试')).toBeInTheDocument()
  })

  it('点击 toast 立即关闭,退出动画结束后卸载', () => {
    renderToast()
    act(() => {
      probe!.show('提示一下')
    })
    fireEvent.click(screen.getByRole('button', { name: /提示一下/ }))
    // 点击后进入退出动画,文案仍短暂可见
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('错误提示 5 秒后自动关闭,成功提示 2.5 秒', () => {
    renderToast()
    act(() => {
      probe!.show({ message: '失败了', type: 'error' })
    })
    // 5 秒计时触发关闭,再推进退出动画
    act(() => {
      vi.advanceTimersByTime(5_100)
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => {
      probe!.show({ message: '成功了', type: 'success' })
    })
    act(() => {
      vi.advanceTimersByTime(2_600)
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
