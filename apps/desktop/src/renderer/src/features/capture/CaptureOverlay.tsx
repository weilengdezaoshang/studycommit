import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaptureOverlayState } from '../../types/study-commit-api'
import { NotebookButton, StateNotice } from '../../components/notebook/Notebook'
import './capture-overlay.css'
import { CaptureSelectionActions } from './CaptureSelectionActions'

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
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const shiftRef = useRef(false)

  const submit = useCallback(() => {
    if (!state || !rect || rect.width < 1 || rect.height < 1 || busy.current || dragStart.current) {
      return
    }
    busy.current = true
    setError('')
    setSubmitting(true)
    void window.studyCommit.capture
      .overlaySelection({ selection: rect })
      .then((result) => {
        if (!result.ok) {
          throw new Error('截图生成失败')
        }
      })
      .catch(() => {
        busy.current = false
        setSubmitting(false)
        setError('截图生成失败，选区已保留，请重试或取消。')
      })
  }, [rect, state])

  const cancel = useCallback(() => {
    if (busy.current) {
      return
    }
    busy.current = true
    setSubmitting(true)
    setError('')
    void window.studyCommit.capture
      .overlayCancel()
      .then((result) => {
        if (!result.ok) {
          throw new Error('取消失败')
        }
      })
      .catch(() => {
        busy.current = false
        setSubmitting(false)
        setError('暂时无法取消，请重试或按 Esc。')
      })
  }, [])

  useEffect(() => {
    const offState = window.studyCommit.capture.onOverlayState(setState)
    void window.studyCommit.capture
      .overlayReady()
      .catch(() => setError('截图画面加载失败，请取消后重试。'))
    return offState
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        shiftRef.current = true
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
      }
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        submit()
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
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [submit, cancel])

  const onMouseDown = (event: React.MouseEvent) => {
    if (busy.current || !state || event.button !== 0) {
      return
    }
    dragStart.current = { x: event.clientX, y: event.clientY }
    setDragging(true)
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
    setDragging(false)
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
      {!dragging && (
        <CaptureSelectionActions rect={rect}>
          {error && <StateNotice>{error}</StateNotice>}
          <div className="capture-selection-actions__row" role="group" aria-label="截图操作">
            <span role="status">
              {submitting
                ? '正在处理截图…'
                : rect && rect.width >= 1 && rect.height >= 1
                  ? '选区已就绪，可重新拖拽调整'
                  : '拖拽选择截图区域'}
            </span>
            <NotebookButton disabled={submitting} onClick={cancel}>
              取消截图 · Esc
            </NotebookButton>
            <NotebookButton
              variant="primary"
              disabled={submitting || !state || !rect || rect.width < 1 || rect.height < 1}
              onClick={submit}
            >
              确认截图 · Enter
            </NotebookButton>
          </div>
        </CaptureSelectionActions>
      )}
    </div>
  )
}
