import { useEffect, useState } from 'react'
import type { ToastViewState } from '@studycommit/common/toast-react'

const ICONS: Record<ToastViewState['type'], string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

/** 退出动画时长,与 .toast 的过渡时长(--motion-duration-normal)保持一致。 */
const EXIT_MS = 260

export function Toast({ message, onClose, type, count }: ToastViewState): React.JSX.Element | null {
  // 消息清空后保留一帧退出动画,避免瞬时跳变
  const [entered, setEntered] = useState(false)
  const [shown, setShown] = useState<{ message: string; type: ToastViewState['type'] } | null>(
    () => (message ? { message, type } : null),
  )
  const signature = message ? `${type}\u0000${message}` : null
  const [shownSignature, setShownSignature] = useState(signature)

  if (message && signature !== shownSignature) {
    setShownSignature(signature)
    setShown({ message, type })
  }

  useEffect(() => {
    if (!message) {
      return
    }
    const frame = requestAnimationFrame(() => {
      setEntered(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [message, type])

  useEffect(() => {
    if (!message && shown) {
      const frame = requestAnimationFrame(() => {
        setEntered(false)
      })
      const timer = setTimeout(() => {
        setShown(null)
        setShownSignature(null)
      }, EXIT_MS)
      return () => {
        cancelAnimationFrame(frame)
        clearTimeout(timer)
      }
    }
  }, [message, shown])

  // 退出动画期间 provider 已重置 type,展示最后一条的类型样式
  const displayed = message ? { message, type } : shown
  if (!displayed) {
    return null
  }
  return (
    <div className={`toast toast--${displayed.type}${entered ? ' is-in' : ''}`} role="status">
      <button type="button" className="toast__message" onClick={onClose}>
        <span className="toast__icon" aria-hidden="true">
          {ICONS[displayed.type]}
        </span>
        {displayed.message}
        {count > 1 && <span className="toast__count">×{count}</span>}
      </button>
    </div>
  )
}
