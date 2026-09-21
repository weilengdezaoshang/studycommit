import { useEffect, useState } from 'react'
import type { PaperWithExtra } from './view-model'
import { Dialog } from '../../components/dialog/Dialog'
import { NotebookButton, StateNotice } from '../../components/notebook/Notebook'

function RecordImage({
  id,
  index,
  onOpen,
}: {
  id: string
  index: number
  onOpen: (url: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    void window.studyCommit.papers
      .assetAccess(id)
      .then((result) => {
        if (!active) {
          return
        }
        if (result.ok) {
          setUrl(result.data.url)
        } else {
          setFailed(true)
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true)
        }
      })
    return () => {
      active = false
    }
  }, [id, revision])
  return (
    <div className="record-image">
      {failed ? (
        <StateNotice
          actions={
            <NotebookButton
              onClick={() => {
                setFailed(false)
                setUrl(null)
                setRevision((n) => n + 1)
              }}
            >
              重新加载
            </NotebookButton>
          }
        >
          图片 {index + 1} 加载失败
        </StateNotice>
      ) : url ? (
        <button
          className="record-image__open"
          onClick={() => onOpen(url)}
          aria-label={`查看第 ${index + 1} 张图片`}
        >
          <img src={url} alt={`记录图片 ${index + 1}`} onError={() => setFailed(true)} />
        </button>
      ) : (
        <p role="status">正在加载图片 {index + 1}…</p>
      )}
    </div>
  )
}

/** 单图失败保留尺寸与其余图片，重试重新获取访问地址。 */
export function RecordAssets({ assets }: { assets: PaperWithExtra['assets'] }) {
  const [viewer, setViewer] = useState<string | null>(null)
  return (
    <>
      <div className="record-assets">
        {assets?.map((asset, index) => (
          <RecordImage key={asset.id} id={asset.id} index={index} onOpen={setViewer} />
        ))}
      </div>
      <Dialog
        open={Boolean(viewer)}
        title="查看记录图片"
        className="record-image-dialog"
        onClose={() => setViewer(null)}
      >
        <NotebookButton onClick={() => setViewer(null)}>关闭图片</NotebookButton>
        {viewer && <img src={viewer} alt="记录图片大图" />}
      </Dialog>
    </>
  )
}
