import { useState } from 'react'
import { useNavigate } from 'react-router'
import { routes } from '../../app/routes'
import { papersActions } from './papers-store'

export function TopicManage({
  topicId,
  name,
  onNotice,
}: {
  topicId: string
  name: string
  onNotice: (message: string) => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [pending, setPending] = useState(false)

  const rename = async () => {
    if (!draftName.trim() || pending) {
      return
    }
    setPending(true)
    try {
      await papersActions.renameTopic(topicId, draftName.trim())
      setRenaming(false)
      onNotice('主题已同步')
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '主题重命名失败')
    } finally {
      setPending(false)
    }
  }

  const remove = async () => {
    if (pending) {
      return
    }
    setPending(true)
    try {
      await papersActions.deleteTopic(topicId)
      navigate(routes.timeline())
    } catch (error) {
      onNotice(error instanceof Error ? error.message : '主题删除失败')
      setPending(false)
    }
  }

  return (
    <details className="records-home__manage">
      <summary>管理这个主题</summary>
      {renaming ? (
        <form
          className="records-home__rename"
          onSubmit={(event) => {
            event.preventDefault()
            void rename()
          }}
        >
          <input
            value={draftName}
            maxLength={18}
            aria-label="主题名称"
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
          />
          <button
            type="submit"
            className="records-home__compose"
            disabled={!draftName.trim() || pending}
          >
            保存
          </button>
          <button
            type="button"
            className="records-home__capture"
            disabled={pending}
            onClick={() => setRenaming(false)}
          >
            取消
          </button>
        </form>
      ) : (
        <div className="records-home__manage-actions">
          <button
            type="button"
            className="records-home__capture"
            disabled={pending}
            onClick={() => {
              setDraftName(name)
              setRenaming(true)
            }}
          >
            重命名
          </button>
          <button
            type="button"
            className="records-home__capture"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`删除「${name}」？里面的纸页会回到待整理。`)) {
                void remove()
              }
            }}
          >
            删除主题
          </button>
        </div>
      )}
    </details>
  )
}
