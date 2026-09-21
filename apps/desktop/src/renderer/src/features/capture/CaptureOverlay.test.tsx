import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CaptureOverlay } from './CaptureOverlay'

const FRAME_STATE = {
  imageDataUrl: 'data:image/png;base64,AAA',
  width: 800,
  height: 600,
  scaleFactor: 2,
}

function installCaptureBridge() {
  let stateListener: ((state: unknown) => void) | null = null
  const overlayCancel = vi.fn(async () => ({ ok: true as const, data: { ok: true as const } }))
  const overlaySelection = vi.fn(async () => ({ ok: true as const, data: { ok: true as const } }))
  const bridge = {
    onOverlayState: vi.fn((listener: (state: unknown) => void) => {
      stateListener = listener
      return () => {
        stateListener = null
      }
    }),
    overlayReady: vi.fn(async () => ({ ok: true as const, data: { ok: true as const } })),
    overlayCancel,
    overlaySelection,
  }
  Object.assign(window.studyCommit, { capture: bridge })
  return {
    pushState: () => {
      act(() => {
        stateListener?.(FRAME_STATE)
      })
    },
    overlayReady: bridge.overlayReady,
    overlayCancel,
    overlaySelection,
  }
}

describe('CaptureOverlay', () => {
  it('拖拽期间隐藏操作栏且重新拖选后只在松开鼠标时显示', () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    bridge.pushState()
    const surface = screen.getByRole('application')
    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.mouseDown(surface, { clientX: 100, clientY: 80 })
      expect(screen.queryByRole('group', { name: '截图操作' })).not.toBeInTheDocument()
      fireEvent.mouseMove(surface, { clientX: 300, clientY: 220 })
      expect(screen.queryByRole('button', { name: '确认截图 · Enter' })).not.toBeInTheDocument()
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(bridge.overlaySelection).not.toHaveBeenCalled()
      fireEvent.mouseUp(surface)
      expect(screen.getByRole('group', { name: '截图操作' })).toBeVisible()
      expect(screen.getByRole('button', { name: '确认截图 · Enter' })).toBeEnabled()
    }
  })
  it('未选择区域时禁用确认并允许点击取消', async () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    bridge.pushState()
    expect(screen.getByRole('button', { name: '确认截图 · Enter' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '取消截图 · Esc' }))
    await waitFor(() => expect(bridge.overlayCancel).toHaveBeenCalledTimes(1))
    expect(bridge.overlaySelection).not.toHaveBeenCalled()
  })

  it('点击确认保留选区坐标且重复操作只提交一次', async () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    bridge.pushState()
    const surface = screen.getByRole('application')
    fireEvent.mouseDown(surface, { clientX: 100, clientY: 80 })
    fireEvent.mouseMove(surface, { clientX: 300, clientY: 220 })
    fireEvent.mouseUp(surface)
    const confirm = screen.getByRole('button', { name: '确认截图 · Enter' })
    fireEvent.mouseDown(confirm, { clientX: 600, clientY: 550 })
    fireEvent.mouseUp(confirm)
    fireEvent.click(confirm)
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(bridge.overlaySelection).toHaveBeenCalledTimes(1)
    expect(bridge.overlaySelection).toHaveBeenCalledWith({
      selection: { x: 100, y: 80, width: 200, height: 140 },
    })
    expect(bridge.overlayCancel).not.toHaveBeenCalled()
    expect(bridge.overlayReady).toHaveBeenCalledTimes(1)
  })

  it('生成失败保留选区并允许再次确认', async () => {
    const bridge = installCaptureBridge()
    bridge.overlaySelection.mockRejectedValueOnce(new Error('IPC 失败'))
    render(<CaptureOverlay />)
    bridge.pushState()
    const surface = screen.getByRole('application')
    fireEvent.mouseDown(surface, { clientX: 30, clientY: 40 })
    fireEvent.mouseMove(surface, { clientX: 230, clientY: 180 })
    fireEvent.mouseUp(surface)
    fireEvent.click(screen.getByRole('button', { name: '确认截图 · Enter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('选区已保留')
    expect(screen.getByText('200 × 140')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '确认截图 · Enter' }))
    expect(bridge.overlaySelection).toHaveBeenCalledTimes(2)
  })

  it('已有选区时点击取消不会生成截图', () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    bridge.pushState()
    const surface = screen.getByRole('application')
    fireEvent.mouseDown(surface, { clientX: 30, clientY: 40 })
    fireEvent.mouseMove(surface, { clientX: 230, clientY: 180 })
    fireEvent.mouseUp(surface)
    fireEvent.click(screen.getByRole('button', { name: '取消截图 · Esc' }))
    expect(bridge.overlayCancel).toHaveBeenCalledTimes(1)
    expect(bridge.overlaySelection).not.toHaveBeenCalled()
  })
  it('接收取屏帧后显示操作提示与帧画面', async () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    await waitFor(() => {
      expect(bridge.overlayReady).toHaveBeenCalled()
    })
    bridge.pushState()
    expect(await screen.findByRole('application', { name: '区域截图选区' })).toBeInTheDocument()
    expect(screen.getByText(/按住 Shift 锁定正方形/)).toBeInTheDocument()
    const image = screen.getByAltText('')
    expect(image).toHaveAttribute('src', 'data:image/png;base64,AAA')
  })

  it('Esc 取消截图并通知主进程', async () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    bridge.pushState()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(bridge.overlayCancel).toHaveBeenCalled()
    })
  })

  it('拖拽出选区后按 Enter 提交选区坐标', async () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    bridge.pushState()
    const surface = await screen.findByRole('application', { name: '区域截图选区' })

    fireEvent.mouseDown(surface, { clientX: 100, clientY: 80 })
    fireEvent.mouseMove(surface, { clientX: 300, clientY: 220 })
    fireEvent.mouseUp(surface, {})

    expect(await screen.findByTestId('capture-selection')).toBeInTheDocument()
    expect(screen.getByText('200 × 140')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Enter' })

    await waitFor(() => {
      expect(bridge.overlaySelection).toHaveBeenCalledWith({
        selection: { x: 100, y: 80, width: 200, height: 140 },
      })
    })
  })
})
