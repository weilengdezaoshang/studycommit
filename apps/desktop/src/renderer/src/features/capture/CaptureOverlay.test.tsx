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
  it('接收取屏帧后显示操作提示与帧画面', async () => {
    const bridge = installCaptureBridge()
    render(<CaptureOverlay />)
    await waitFor(() => {
      expect(bridge.overlayReady).toHaveBeenCalled()
    })
    bridge.pushState()
    expect(await screen.findByRole('application', { name: '区域截图选区' })).toBeInTheDocument()
    expect(screen.getByText(/拖拽选择截图区域/)).toBeInTheDocument()
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
