import { useEffect, useRef, useState } from 'react'
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
  const [leaving, setLeaving] = useState(false)
  const [entered, setEntered] = useState(false)
  const lastContent = useRef<{ message: string; type: ToastViewState['type'] } | null>(null)

  useEffect(() => {
    if (message) {
      lastContent.current = { message, type }
      setLeaving(false)
      const raf = requestAnimationFrame(() => setEntered(true))
      return () => cancelAnimationFrame(raf)
    }
    if (lastContent.current) {
      setEntered(false)
      setLeaving(true)
      const timer = setTimeout(() => {
        lastContent.current = null
        setLeaving(false)
      }, EXIT_MS)
      return () => clearTimeout(timer)
    }
  }, [message, type])

  if (!Boolean(message) && !leaving) {
    return null
  }
  // 退出动画期间 provider 已重置 type,展示最后一条的类型样式
  const shown = message ? { message, type } : lastContent.current
  if (!shown) {
    return null
  }
  return (
    <div className={`toast toast--${shown.type}${entered ? ' is-in' : ''}`} role="status">
      <button type="button" className="toast__message" onClick={onClose}>
        <span className="toast__icon" aria-hidden="true">
          {ICONS[shown.type]}
        </span>
        {shown.message}
        {count > 1 && <span className="toast__count">×{count}</span>}
      </button>
    </div>
  )
}
