import { validateLocalDateTimeValue } from '../study-session-runtime'

/** 对话框主字段:datetime-local 用于修正结束时间,text 用于一般输入。 */
export interface DialogFieldOptions {
  label: string
  type?: 'text' | 'datetime-local'
  defaultValue: string
  maxLength?: number
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

export interface DialogConfirmPayload {
  fieldValue?: string
  notes: Record<string, string>
}

export interface DialogShowOptions {
  title: string
  description?: string
  cancelLabel?: string
  confirmLabel?: string
  confirmBusyLabel?: string
  field?: DialogFieldOptions
  notes?: ReadonlyArray<DialogNoteField>
  onConfirm?: (payload: DialogConfirmPayload) => void | Promise<void>
}

/** 字段校验:datetime-local 校验格式与下限;其余类型按 required 校验非空。 */
export function validateDialogField(
  field: DialogFieldOptions | undefined,
  value: string,
): string | null {
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

/** 初始化备注字段:按 defaultValue 建立键值表。 */
export function notesRecord(
  notes: ReadonlyArray<DialogNoteField> | undefined,
): Record<string, string> {
  const record: Record<string, string> = {}
  for (const note of notes ?? []) {
    record[note.key] = note.defaultValue ?? ''
  }
  return record
}
