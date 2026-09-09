import { useDialogController } from '@studycommit/common/dialog-react'
import { Dialog } from './Dialog'

export type { DialogNoteField, DialogShowOptions } from '@studycommit/common/dialog-react'

/**
 * 桌面对话框:状态机复用 @studycommit/common/dialog-react,
 * 确认失败保持打开并内联展示错误;本文件只负责 DOM 渲染。
 */
export function useDialog() {
  const controller = useDialogController()
  const { options } = controller

  const dialog = (
    <Dialog
      open={controller.visible}
      title={options?.title ?? ''}
      busy={controller.busy}
      onClose={controller.close}
    >
      {options?.description ? <p>{options.description}</p> : null}
      {options?.extraContent}
      {options?.field ? (
        <label className="field">
          <span>{options.field.label}</span>
          <input
            type={options.field.type ?? 'text'}
            value={controller.fieldValue}
            min={options.field.min}
            maxLength={options.field.maxLength}
            onChange={(event) => controller.updateField(event.target.value)}
            required={options.field.required}
          />
          {controller.fieldError ? (
            <span className="field__hint" role="alert">
              {controller.fieldError}
            </span>
          ) : options.field.helperText ? (
            <span className="field__hint">{options.field.helperText}</span>
          ) : null}
        </label>
      ) : controller.fieldError ? (
        <p className="field__hint" role="alert">
          {controller.fieldError}
        </p>
      ) : null}
      {options?.notes?.map((note) => (
        <div className="field" key={note.key}>
          <label htmlFor={`dialog-note-${note.key}`}>{note.label}</label>
          <textarea
            id={`dialog-note-${note.key}`}
            value={controller.notes[note.key] ?? ''}
            maxLength={note.maxLength}
            rows={3}
            placeholder={note.placeholder}
            onChange={(event) => controller.updateNote(note.key, event.target.value)}
          />
        </div>
      ))}
      <div className="dialog__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={controller.close}
          disabled={controller.busy}
        >
          {options?.cancelLabel ?? '取消'}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => void controller.confirm()}
          disabled={controller.busy}
        >
          {controller.busy
            ? (options?.confirmBusyLabel ?? '处理中')
            : (options?.confirmLabel ?? '确认')}
        </button>
      </div>
    </Dialog>
  )

  return { show: controller.show, close: controller.close, dialog }
}
