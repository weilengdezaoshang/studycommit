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

export type ToastShowOptions = {
  message: string
  type?: 'default' | 'error'
  durationMs?: number
}

export type ToastApi = {
  show: (input: string | ToastShowOptions) => void
  close: () => void
}

export type ToastViewState = {
  message: string | null
  type: 'default' | 'error'
  onClose: () => void
}

const DEFAULT_DURATION_MS = 4000
const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({
  children,
  renderToast,
}: {
  children: ReactNode
  renderToast: (state: ToastViewState) => ReactNode
}): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const [type, setType] = useState<ToastViewState['type']>('default')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setMessage(null)
    setType('default')
  }, [])

  const show = useCallback((input: string | ToastShowOptions) => {
    const next = typeof input === 'string' ? input : input.message
    const nextType = typeof input === 'string' ? 'default' : (input.type ?? 'default')
    const durationMs =
      typeof input === 'string' ? DEFAULT_DURATION_MS : (input.durationMs ?? DEFAULT_DURATION_MS)
    if (timer.current !== null) {
      clearTimeout(timer.current)
    }
    setMessage(next)
    setType(nextType)
    timer.current = setTimeout(() => {
      timer.current = null
      setMessage(null)
    }, durationMs)
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current)
      }
    }
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, close }), [close, show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {renderToast({ message, onClose: close, type })}
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
