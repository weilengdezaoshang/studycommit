import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Dialog({
  open,
  title,
  busy = false,
  onClose,
  children,
}: {
  open: boolean
  title: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
}): React.JSX.Element | null {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    previousFocus.current = document.activeElement
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )
    focusable?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
      }
    }
  }, [busy, onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
