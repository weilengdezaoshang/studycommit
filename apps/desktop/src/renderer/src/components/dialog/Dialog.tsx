import { useEffect, useId, useRef, type ReactNode } from 'react'

const dialogStack: string[] = []
const focusSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [contenteditable="true"], [tabindex="0"]'

export function Dialog({
  open,
  title,
  busy = false,
  className,
  onClose,
  children,
}: {
  open: boolean
  title: string
  busy?: boolean
  className?: string
  onClose: () => void
  children: ReactNode
}): React.JSX.Element | null {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const current = useRef({ busy, onClose })
  useEffect(() => {
    current.current = { busy, onClose }
  }, [busy, onClose])

  useEffect(() => {
    if (!open) {
      return
    }
    previousFocus.current = document.activeElement
    dialogStack.push(titleId)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = panelRef.current?.querySelector<HTMLElement>(focusSelector)
    ;(focusable ?? panelRef.current)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== titleId) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!current.current.busy) {
          current.current.onClose()
        }
      }
      if (event.key === 'Tab') {
        const items = [
          ...(panelRef.current?.querySelectorAll<HTMLElement>(focusSelector) ?? []),
        ].filter(
          (item) =>
            !item.closest('[hidden], [inert]') &&
            (!item.closest('details:not([open])') || item.tagName === 'SUMMARY'),
        )
        const first = items[0]
        const last = items.at(-1)
        if (!first) {
          event.preventDefault()
          panelRef.current?.focus()
          return
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === panelRef.current)
        ) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      dialogStack.splice(dialogStack.indexOf(titleId), 1)
      document.body.style.overflow = previousOverflow
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
      }
    }
  }, [open, titleId])

  if (!open) {
    return null
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        ref={panelRef}
        className={className ? `dialog ${className}` : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
