import { useCallback, useState } from 'react'
import { notesRecord, validateDialogField, type DialogShowOptions } from './dialog-options'

export interface DialogViewState {
  /** 对话框是否处于打开状态;关闭动画期间 options 仍保留供渲染层显示内容 */
  visible: boolean
  busy: boolean
  options: DialogShowOptions | null
  fieldValue: string
  notes: Record<string, string>
  fieldError: string | null
}

export interface DialogController extends DialogViewState {
  show: (options: DialogShowOptions) => void
  /** 请求关闭:busy 时忽略;内容保留到宿主调用 dismiss(供关闭动画使用) */
  close: () => void
  /** 彻底清空:渲染层关闭动画结束后的回调点(如 RN Modal onDismiss) */
  dismiss: () => void
  confirm: () => Promise<void>
  /** 更新主字段并清除字段错误 */
  updateField: (value: string) => void
  updateNote: (key: string, value: string) => void
}

export interface DialogControllerOptions {
  /**
   * 确认回调失败后的行为:
   * - 'inline'(默认):保持打开,在字段位置内联展示错误(桌面端);
   * - 'dismiss':关闭对话框并把错误交给宿主提示(移动端 Toast)。
   */
  actionErrorMode?: 'inline' | 'dismiss'
  /** actionErrorMode 为 'dismiss' 时接收错误与已归一化的文案 */
  onActionError?: (error: unknown, message: string) => void
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '操作失败'
}

/**
 * 对话框状态机(SH 复用):options/busy/fieldValue/notes/fieldError
 * 与 show/close/confirm 的完整规则,渲染层由各端注入。
 */
export function useDialogController(config: DialogControllerOptions = {}): DialogController {
  const { actionErrorMode = 'inline', onActionError } = config
  const [visible, setVisible] = useState(false)
  const [dialog, setDialog] = useState<DialogShowOptions | null>(null)
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

  const dismiss = useCallback(() => {
    setVisible(false)
    setDialog(null)
    setFieldError(null)
  }, [])

  const show = useCallback((next: DialogShowOptions) => {
    setFieldValue(next.field?.defaultValue ?? '')
    setNotes(notesRecord(next.notes))
    setFieldError(null)
    setBusy(false)
    setDialog(next)
    setVisible(true)
  }, [])

  const updateField = useCallback((value: string) => {
    setFieldValue(value)
    setFieldError(null)
  }, [])

  const updateNote = useCallback((key: string, value: string) => {
    setNotes((current) => ({ ...current, [key]: value }))
  }, [])

  const confirm = async () => {
    if (!dialog) {
      return
    }
    const nextFieldError = validateDialogField(dialog.field, fieldValue)
    if (nextFieldError) {
      setFieldError(nextFieldError)
      return
    }
    setBusy(true)
    try {
      await dialog.onConfirm?.({ fieldValue, notes })
      setVisible(false)
      setDialog(null)
      setFieldError(null)
    } catch (error) {
      const message = errorMessageOf(error)
      if (actionErrorMode === 'dismiss') {
        setVisible(false)
        setDialog(null)
        setFieldError(null)
        onActionError?.(error, message)
      } else {
        setFieldError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  return {
    visible,
    busy,
    options: dialog,
    fieldValue,
    notes,
    fieldError,
    show,
    close,
    dismiss,
    confirm,
    updateField,
    updateNote,
  }
}
