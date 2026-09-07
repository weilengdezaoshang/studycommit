import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureOverlayState } from '../../types/study-commit-api'

interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

function normalizeRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  lockSquare: boolean,
): SelectionRect {
  let width = endX - startX
  let height = endY - startY
  if (lockSquare) {
    const size = Math.min(Math.abs(width), Math.abs(height))
    width = Math.sign(width) * size
    height = Math.sign(height) * size
  }
  return {
    x: Math.min(startX, startX + width),
    y: Math.min(startY, startY + height),
    width: Math.abs(width),
    height: Math.abs(height),
  }
}

/** 区域截图覆盖窗(DE-310):渲染取屏帧,拖拽选区,Enter 确认 / Esc 取消。 */
export function CaptureOverlay(): React.JSX.Element {
  const [state, setState] = useState<CaptureOverlayState | null>(null)
  const [rect, setRect] = useState<SelectionRect | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const shiftRef = useRef(false)

  const submit = useCallback(() => {
    if (!rect || submitting) {
      return
    }
    setSubmitting(true)
    void window.studyCommit.capture.overlaySelection({ selection: rect })
  }, [rect, submitting])

  useEffect(() => {
    const offState = window.studyCommit.capture.onOverlayState(setState)
    void window.studyCommit.capture.overlayReady()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        shiftRef.current = true
      }
      if (event.key === 'Escape') {
        void window.studyCommit.capture.overlayCancel()
      }
      if (event.key === 'Enter' && rect && rect.width >= 1 && rect.height >= 1) {
        void submit()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        shiftRef.current = false
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      offState()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect])

  const onMouseDown = (event: React.MouseEvent) => {
    if (submitting) {
      return
    }
    dragStart.current = { x: event.clientX, y: event.clientY }
    setRect({ x: event.clientX, y: event.clientY, width: 0, height: 0 })
  }

  const onMouseMove = (event: React.MouseEvent) => {
    const start = dragStart.current
    if (!start) {
      return
    }
    setRect(normalizeRect(start.x, start.y, event.clientX, event.clientY, shiftRef.current))
  }

  const onMouseUp = () => {
    dragStart.current = null
  }

  return (
    <div
      role="application"
      aria-label="区域截图选区"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: 'crosshair',
        overflow: 'hidden',
        background: '#000',
        userSelect: 'none',
      }}
    >
      {state ? (
        <img
          src={state.imageDataUrl}
          alt=""
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      ) : null}
      {rect ? (
        <div
          data-testid="capture-selection"
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            border: '1px solid #7BD88F',
            boxShadow: '0 0 0 100000px rgba(0, 0, 0, 0.35)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -24,
              left: 0,
              color: '#fff',
              fontSize: 12,
              background: 'rgba(0,0,0,0.6)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {rect.width} × {rect.height}
          </span>
        </div>
      ) : null}
      {!rect ? (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#fff',
            fontSize: 13,
            background: 'rgba(0,0,0,0.55)',
            padding: '6px 14px',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        >
          拖拽选择截图区域，Enter 确认，Esc 取消；按住 Shift 锁定正方形
        </div>
      ) : null}
      {submitting ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
            background: 'rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          正在生成截图…
        </div>
      ) : null}
    </div>
  )
}
