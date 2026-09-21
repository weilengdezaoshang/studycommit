import { Dialog } from '../../components/dialog/Dialog'
import {
  EmptyState,
  LoadingState,
  NotebookButton,
  StateNotice,
} from '../../components/notebook/Notebook'
import { ComposeFields } from './ComposeFields'
import { useComposeController } from './use-compose-controller'
import { useCaptureEntry } from '../capture/use-capture-entry'
import './record-composer.css'
import { SketchBorder } from '../../components/notebook/SketchBorder'

export function RecordComposer({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const editor = useComposeController(onClose, onSaved)
  const capture = useCaptureEntry()
  return (
    <>
      <Dialog
        open
        title="记一点"
        className="record-composer"
        busy={editor.busy || capture.busy}
        onClose={editor.requestClose}
      >
        <SketchBorder />
        <button
          className="record-composer__close"
          aria-label="关闭记录弹窗"
          disabled={editor.busy || capture.busy}
          onClick={editor.requestClose}
        >
          ×
        </button>
        <div className="record-composer__scroll" inert={editor.confirmClose || undefined}>
          <div className="secondary-meta">
            <time>
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </time>
            <span className="record-composer__topic">待整理</span>
          </div>
          {editor.loadError ? (
            <EmptyState error title="未能读取上次草稿" description={editor.loadError}>
              <NotebookButton onClick={() => void editor.retryLoad()}>重新读取</NotebookButton>
            </EmptyState>
          ) : editor.loading || !editor.draft ? (
            <LoadingState label="正在打开编辑器…" />
          ) : (
            <ComposeFields
              draft={editor.draft}
              disabled={editor.busy}
              dispatch={editor.dispatch}
              onValidityChange={editor.setDocumentValid}
            />
          )}
          {editor.recovered && <StateNotice tone="info">已恢复上次未保存的记录</StateNotice>}
          {editor.storageError && (
            <StateNotice
              actions={
                <>
                  <NotebookButton onClick={() => void editor.copy()}>复制内容</NotebookButton>
                  <NotebookButton onClick={() => void editor.retryPersist()}>
                    重试保存草稿
                  </NotebookButton>
                </>
              }
            >
              {editor.storageError}
            </StateNotice>
          )}
          {editor.saveError && (
            <StateNotice>{editor.saveError}。输入内容仍在当前窗口中。</StateNotice>
          )}
          {editor.notice && <StateNotice tone="info">{editor.notice}</StateNotice>}
          {capture.notice && <StateNotice tone="info">{capture.notice}</StateNotice>}
          {capture.permissionDenied && (
            <StateNotice
              tone="warning"
              actions={
                <NotebookButton onClick={() => void capture.openSettings()}>
                  打开系统设置
                </NotebookButton>
              }
            >
              需要屏幕录制权限，请允许 StudyCommit，按系统提示重新打开应用后再试。
            </StateNotice>
          )}
        </div>
        <footer className="record-composer__footer" inert={editor.confirmClose || undefined}>
          <NotebookButton
            disabled={editor.busy || capture.busy}
            onClick={() => void capture.start()}
          >
            截图学习 ↗
          </NotebookButton>
          <span role="status">
            {editor.saving ? '正在保存，请稍候' : editor.savedAt ? '草稿已保存到本机' : '尚未保存'}
          </span>
          <div className="notebook-actions">
            <NotebookButton disabled={editor.busy || capture.busy} onClick={editor.requestClose}>
              取消
            </NotebookButton>
            <NotebookButton
              variant="primary"
              disabled={!editor.canSave || capture.busy}
              onClick={() => void editor.saveRecord()}
            >
              {editor.saving ? '保存中…' : editor.saveError ? '重试保存' : '保存记录'}
            </NotebookButton>
          </div>
        </footer>
      </Dialog>
      <Dialog
        open={editor.confirmClose}
        title="保留草稿后关闭？"
        className="record-close-confirm"
        busy={editor.busy}
        onClose={() => editor.setConfirmClose(false)}
      >
        <p>当前内容尚未保存为记录。保存到本机成功后才会关闭。</p>
        {editor.storageError && <StateNotice>{editor.storageError}</StateNotice>}
        <div className="notebook-actions">
          <NotebookButton
            variant="primary"
            disabled={editor.busy}
            onClick={() => editor.setConfirmClose(false)}
          >
            继续编辑
          </NotebookButton>
          <NotebookButton disabled={editor.busy} onClick={() => void editor.close()}>
            保留草稿并关闭
          </NotebookButton>
          <NotebookButton
            variant="danger"
            disabled={editor.busy}
            onClick={() => void editor.close(true)}
          >
            放弃草稿
          </NotebookButton>
        </div>
      </Dialog>
    </>
  )
}
