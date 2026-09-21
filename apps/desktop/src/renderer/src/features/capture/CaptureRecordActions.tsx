import type { ReactNode } from 'react'
import { NotebookButton } from '../../components/notebook/Notebook'
import { SketchBorder } from '../../components/notebook/SketchBorder'

/** 仅负责保存操作的布局和反馈，不发起上传或创建记录。 */
export function CaptureRecordActions({
  count,
  busy,
  saving,
  hasText,
  onSaveImages,
  onSaveText,
  children,
}: {
  count: number
  busy: boolean
  saving: boolean
  hasText: boolean
  onSaveImages: () => void
  onSaveText: () => void
  children?: ReactNode
}) {
  return (
    <div className="capture-record-actions" role="group" aria-label="保存截图记录">
      <NotebookButton
        disabled={busy || !hasText}
        title={hasText ? '只保存文字，不绑定截图' : '识别原文为空时无法仅保存文字'}
        onClick={onSaveText}
      >
        <SketchBorder />
        仅保存文字
      </NotebookButton>
      <div className="capture-record-actions__primary">
        {children}
        <NotebookButton
          variant="primary"
          className="capture-record-actions__save"
          disabled={busy || count === 0}
          aria-busy={saving}
          aria-label={saving ? '正在保存图片记录' : `保存图片记录（${count} 张）`}
          onClick={onSaveImages}
        >
          <SketchBorder />
          <span>{saving ? '正在保存…' : '保存图片记录'}</span>
          <span className="capture-record-actions__count" aria-hidden="true">
            {count} 张
          </span>
        </NotebookButton>
      </div>
    </div>
  )
}
