import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * 反馈三层分工:操作结果走 Toast;进行中/长状态走行内 status;
 * 破坏性确认走 Dialog。Toast 只有三态:success / error / info。
 */
export type ToastType = 'success' | 'error' | 'info'

export type ToastShowOptions = {
  message: string
  /** 旧调用可能传 'default',按 info 处理。 */
  type?: ToastType | 'default'
  durationMs?: number
}

export type ToastApi = {
  show: (input: string | ToastShowOptions) => void
  close: () => void
}

export type ToastViewState = {
  message: string | null
  type: ToastType
  /** 同一文案连续出现的次数;>1 时渲染层显示「×N」。 */
  count: number
  onClose: () => void
}

/** 分类型默认时长:成功 2.5s / 失败 5s / 提示 3s;显式 durationMs 优先。 */
const TYPE_DURATION_MS: Record<ToastType, number> = {
  success: 2_500,
  error: 5_000,
  info: 3_000,
}

/** 旧调用可能传 'default',按 info 处理。 */
export function normalizeToastType(type: ToastShowOptions['type']): ToastType {
  return type === 'success' || type === 'error' ? type : 'info'
}

/** 显式 durationMs 优先,否则按类型取默认时长。 */
export function resolveToastDuration(type: ToastType, explicit?: number): number {
  return explicit ?? TYPE_DURATION_MS[type]
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({
  children,
  renderToast,
}: {
  children: ReactNode
  renderToast: (state: ToastViewState) => ReactNode
}): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const [type, setType] = useState<ToastType>('info')
  const [count, setCount] = useState(1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearTimer()
    setMessage(null)
    setCount(1)
    setType('info')
  }, [clearTimer])

  const show = useCallback(
    (input: string | ToastShowOptions) => {
      const next = typeof input === 'string' ? input : input.message
      const nextType = normalizeToastType(typeof input === 'string' ? undefined : input.type)
      // 同类文案合并为一条,由渲染层显示 ×N 计数
      if (next === message && nextType === type && timer.current !== null) {
        setCount((current) => current + 1)
      } else {
        setCount(1)
        setType(nextType)
        setMessage(next)
      }
      clearTimer()
      const duration =
        typeof input === 'string'
          ? resolveToastDuration('info')
          : resolveToastDuration(nextType, input.durationMs)
      timer.current = setTimeout(() => {
        timer.current = null
        setMessage(null)
      }, duration)
    },
    [clearTimer, message, type],
  )

  useEffect(() => {
    return clearTimer
  }, [clearTimer])

  const api = useMemo<ToastApi>(() => ({ show, close }), [close, show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {renderToast({ message, type, count, onClose: close })}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) {
    throw new Error('ToastProvider 未就绪')
  }
  return toast
}

export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext)
}
