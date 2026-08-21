import { useCallback, useState } from 'react'
import { validateLocalDateTimeValue } from '@studycommit/common/study-session-runtime'
import { Dialog } from './Dialog'

export interface DialogNoteField {
  key: string
  label: string
  placeholder?: string
  maxLength?: number
  defaultValue?: string
}

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
    required?: boolean
    helperText?: string
  }
  notes?: ReadonlyArray<DialogNoteField>
  onConfirm?: (payload: {
    fieldValue?: string
    notes: Record<string, string>
  }) => void | Promise<void>
}

export function useDialog() {
  const [options, setOptions] = useState<DialogShowOptions | null>(null)
  const [busy, setBusy] = useState(false)
  const [fieldValue, setFieldValue] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [fieldError, setFieldError] = useState<string | null>(null)

  const close = useCallback(() => {
    if (busy) {
      return
    }
    setOptions(null)
    setFieldError(null)
  }, [busy])

  const show = useCallback((next: DialogShowOptions) => {
    setFieldValue(next.field?.defaultValue ?? '')
    setNotes(notesRecord(next.notes))
    setFieldError(null)
    setBusy(false)
    setOptions(next)
  }, [])

  const confirm = async () => {
    if (!options) {
      return
    }
    if (options.field?.type === 'datetime-local') {
      const nextFieldError = validateLocalDateTimeValue(fieldValue, options.field.min)
      if (nextFieldError) {
        setFieldError(nextFieldError)
        return
      }
    }
    setBusy(true)
    try {
      await options.onConfirm?.({ fieldValue, notes })
      setOptions(null)
      setFieldError(null)
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : '操作失败')
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
            onChange={(event) => {
              setFieldValue(event.target.value)
              setFieldError(null)
            }}
            required={options.field.required}
          />
          {fieldError ? (
            <span className="field__hint" role="alert">
              {fieldError}
            </span>
          ) : options.field.helperText ? (
            <span className="field__hint">{options.field.helperText}</span>
          ) : null}
        </label>
      ) : fieldError ? (
        <p className="field__hint" role="alert">
          {fieldError}
        </p>
      ) : null}
      {options?.notes?.map((note) => (
        <div className="field" key={note.key}>
          <label htmlFor={`dialog-note-${note.key}`}>{note.label}</label>
          <textarea
            id={`dialog-note-${note.key}`}
            value={notes[note.key] ?? ''}
            maxLength={note.maxLength}
            rows={3}
            placeholder={note.placeholder}
            onChange={(event) => {
              const value = event.target.value
              setNotes((current) => ({ ...current, [note.key]: value }))
            }}
          />
        </div>
      ))}
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

function notesRecord(notes: DialogShowOptions['notes']): Record<string, string> {
  const record: Record<string, string> = {}
  for (const note of notes ?? []) {
    record[note.key] = note.defaultValue ?? ''
  }
  return record
}
