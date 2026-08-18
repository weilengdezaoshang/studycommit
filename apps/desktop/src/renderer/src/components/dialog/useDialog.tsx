import { useCallback, useState } from 'react'
import { Dialog } from './Dialog'

export interface DialogShowOptions {
  title: string
  description?: string
  cancelLabel?: string
  confirmLabel?: string
  confirmBusyLabel?: string
  field?: {
    label: string
    type: 'datetime-local'
    defaultValue: string
    min?: string
  }
  onConfirm?: (payload: { fieldValue?: string }) => void | Promise<void>
}

export function useDialog() {
  const [options, setOptions] = useState<DialogShowOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const [fieldValue, setFieldValue] = useState('')

  const close = useCallback(() => {
    if (busy) {
      return
    }
    setOptions(null)
  }, [busy])

  const show = useCallback((next: DialogShowOptions) => {
    setFieldValue(next.field?.defaultValue ?? '')
    setBusy(false)
    setOptions(next)
  }, [])

  const confirm = async () => {
    if (!options) {
      return
    }
    setBusy(true)
    try {
      await options.onConfirm?.({ fieldValue })
      setOptions(null)
    } finally {
      setBusy(false)
    }
  }

  const dialog = (
    <Dialog open={options !== null} title={options?.title ?? ''} busy={busy} onClose={close}>
      {options?.description ? <p>{options.description}</p> : null}
      {options?.field ? (
        <label className="field">
          <span>{options.field.label}</span>
          <input
            type={options.field.type}
            value={fieldValue}
            min={options.field.min}
            onChange={(event) => setFieldValue(event.target.value)}
            required
          />
        </label>
      ) : null}
      <div className="dialog__actions">
        <button type="button" className="button button--secondary" onClick={close} disabled={busy}>
          {options?.cancelLabel ?? '取消'}
        </button>
        <button type="button" className="button" onClick={() => void confirm()} disabled={busy}>
          {busy ? (options?.confirmBusyLabel ?? '处理中') : (options?.confirmLabel ?? '确认')}
        </button>
      </div>
    </Dialog>
  )

  return { show, close, dialog }
}
