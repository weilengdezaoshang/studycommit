import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { validateLocalDateTimeValue } from '@studycommit/common/study-session-runtime'
import { useAppTheme } from '../../theme/ThemeProvider'
import { AppText } from '../AppText'
import { Button } from '../Button'
import { TextField } from '../TextField'
import { Dialog } from './Dialog'

export interface DialogFieldOptions {
  label: string
  type?: 'text' | 'datetime-local'
  defaultValue: string
  min?: string
  required?: boolean
  helperText?: string
}

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
  field?: DialogFieldOptions
  notes?: ReadonlyArray<DialogNoteField>
  onConfirm?: (payload: {
    fieldValue?: string
    notes: Record<string, string>
  }) => void | Promise<void>
}

export function useDialog() {
  const theme = useAppTheme()
  const [options, setOptions] = useState<DialogShowOptions | null>(null)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fieldValue, setFieldValue] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [fieldError, setFieldError] = useState<string | null>(null)

  const close = useCallback(() => {
    if (busy) {
      return
    }
    setVisible(false)
    setFieldError(null)
  }, [busy])

  const show = useCallback((next: DialogShowOptions) => {
    setFieldValue(next.field?.defaultValue ?? '')
    setNotes(notesRecord(next.notes))
    setFieldError(null)
    setBusy(false)
    setOptions(next)
    setVisible(true)
  }, [])

  const confirm = async () => {
    if (!options) {
      return
    }
    const nextFieldError = validateDialogField(options.field, fieldValue)
    if (nextFieldError) {
      setFieldError(nextFieldError)
      return
    }
    setBusy(true)
    try {
      await options.onConfirm?.({ fieldValue, notes })
      setVisible(false)
      setFieldError(null)
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const dialog = (
    <Dialog
      busy={busy}
      onClose={close}
      onDismiss={() => setOptions(null)}
      open={visible}
      title={options?.title ?? ''}
    >
      {options?.description ? <AppText color="muted">{options.description}</AppText> : null}
      {options?.field ? (
        <TextField
          error={fieldError ?? undefined}
          helperText={options.field.helperText}
          label={options.field.label}
          onChangeText={(value) => {
            setFieldValue(value)
            setFieldError(null)
          }}
          placeholder={options.field.type === 'datetime-local' ? 'YYYY-MM-DDTHH:mm' : undefined}
          value={fieldValue}
        />
      ) : null}
      {fieldError && !options?.field ? <AppText color="danger">{fieldError}</AppText> : null}
      {options?.notes?.map((note) => (
        <TextField
          key={note.key}
          label={note.label}
          maxLength={note.maxLength}
          multiline
          onChangeText={(value) => {
            setNotes((current) => ({ ...current, [note.key]: value }))
          }}
          placeholder={note.placeholder}
          scrollEnabled
          style={{ height: 96, maxHeight: 96 }}
          value={notes[note.key] ?? ''}
        />
      ))}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
        <Button disabled={busy} onPress={close} variant="secondary">
          {options?.cancelLabel ?? '取消'}
        </Button>
        <Button loading={busy} onPress={() => void confirm()}>
          {busy ? (options?.confirmBusyLabel ?? '处理中') : (options?.confirmLabel ?? '确认')}
        </Button>
      </View>
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

function validateDialogField(field: DialogFieldOptions | undefined, value: string): string | null {
  if (!field) {
    return null
  }
  if (field.type === 'datetime-local') {
    return validateLocalDateTimeValue(value, field.min)
  }
  if (field.required && !value.trim()) {
    return `请填写${field.label}`
  }
  return null
}
