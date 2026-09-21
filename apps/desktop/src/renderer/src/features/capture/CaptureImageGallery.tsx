import { useState } from 'react'
import type { CaptureState } from '@studycommit/common/capture-runtime'
import { NotebookButton } from '../../components/notebook/Notebook'
import { Dialog } from '../../components/dialog/Dialog'
import { SketchBorder } from '../../components/notebook/SketchBorder'

/** 截图浏览和排序；上传与识别由上层负责。 */
export function CaptureImageGallery({
  images,
  busy,
  adding,
  previewFailures,
  onAdd,
  onMove,
  onRemove,
}: {
  images: CaptureState['images']
  busy: boolean
  adding: boolean
  previewFailures: string[]
  onAdd: () => void
  onMove: (id: string, delta: -1 | 1) => void
  onRemove: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const selected = images.find((image) => image.id === selectedId) ?? images.at(-1)
  const working = images.filter((image) => image.status === 'working').length
  const empty = images.some((image) => image.status === 'empty')
  const failed = images.some((image) => image.status === 'failed')
  return (
    <section className="capture-gallery" aria-label="截图附件">
      <div className="capture-section-label">
        <span>截图</span>
        <span>{images.length} / 9</span>
      </div>
      <button
        className="capture-gallery__preview"
        type="button"
        disabled={!selected?.uri}
        onClick={() => setExpanded(true)}
        aria-label="放大查看截图"
      >
        <SketchBorder />
        {selected?.uri ? (
          <img src={selected.uri} alt="截图预览" />
        ) : (
          <span>
            {selected && previewFailures.includes(selected.id) ? '预览不可用' : '正在加载预览…'}
          </span>
        )}
      </button>
      <div className="capture-gallery__strip" hidden={images.length === 1}>
        {images.map((item, index) => (
          <div className="capture-gallery__item" key={item.id}>
            <button
              type="button"
              className="capture-gallery__thumb"
              aria-label={`选择第 ${index + 1} 张截图`}
              aria-pressed={selected?.id === item.id}
              onClick={() => setSelectedId(item.id)}
            >
              {item.uri ? (
                <img src={item.uri} alt={`第 ${index + 1} 张截图`} />
              ) : (
                <span>{index + 1}</span>
              )}
            </button>
            {images.length > 1 && (
              <div className="capture-gallery__tools">
                <button
                  type="button"
                  aria-label={`第 ${index + 1} 张上移`}
                  disabled={busy || index === 0}
                  onClick={() => onMove(item.id, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={`第 ${index + 1} 张下移`}
                  disabled={busy || index === images.length - 1}
                  onClick={() => onMove(item.id, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  aria-label={`删除第 ${index + 1} 张`}
                  disabled={busy}
                  onClick={() => onRemove(item.id)}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <NotebookButton
        className="capture-gallery__add"
        disabled={busy || images.length >= 9}
        onClick={onAdd}
        aria-label={adding ? '正在选取截图…' : `追加截图（${images.length}/9）`}
      >
        {adding ? '正在选取截图…' : '＋ 追加截图'}
      </NotebookButton>
      <div className="capture-gallery__status" role="status">
        {working
          ? '正在识别文字，可继续操作'
          : failed
            ? '部分文字识别失败，图片已保留'
            : empty
              ? '未识别到文字，请确认文字完整入框，也可以手动输入。'
              : '点击图片可放大核对'}
      </div>
      <Dialog
        open={expanded}
        title="查看截图"
        className="capture-image-viewer"
        onClose={() => setExpanded(false)}
      >
        <NotebookButton onClick={() => setExpanded(false)}>返回编辑</NotebookButton>
        {selected?.uri && <img src={selected.uri} alt="截图大图" />}
      </Dialog>
    </section>
  )
}
