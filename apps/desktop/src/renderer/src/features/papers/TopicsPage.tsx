import { useState } from 'react'
import { Link } from 'react-router'
import { papersActions, usePapersState } from './papers-store'
import { routes } from '../../app/routes'
import './secondary-pages.css'

export function TopicsPage() {
  const state = usePapersState()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 18) {
      setError('请输入 1–18 个字符的主题名称')
      return
    }
    if (state.topics.some((topic) => topic.id !== editing && topic.name === trimmed)) {
      setError('已有同名主题')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editing === 'new') {
        await papersActions.createTopicConfirmed(trimmed)
      } else if (editing) {
        await papersActions.renameTopic(editing, trimmed)
      }
      setEditing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="secondary-page" aria-label="我的主题">
      <Link to={routes.timeline()}>← 返回记录本</Link>
      <header className="secondary-page__bar">
        <h1>我的主题</h1>
        <button
          className="secondary-primary"
          onClick={() => {
            setEditing('new')
            setName('')
            setError('')
          }}
        >
          ＋ 新建主题
        </button>
      </header>
      <p className="secondary-meta">{state.topics.length} 个主题 · 当前已加载的记录</p>
      {editing && (
        <form
          className="secondary-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label>
            {editing === 'new' ? '新建主题' : '重命名主题'}{' '}
            <input
              autoFocus
              aria-label="主题名称"
              value={name}
              maxLength={18}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? '保存中…' : '保存'}</button>
          <button type="button" disabled={busy} onClick={() => setEditing(null)}>
            取消
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="secondary-sheet topic-directory">
        {state.topics.map((topic, index) => {
          const records = state.papers.filter(
            (paper) => paper.topicId === topic.id && !paper.deletedAt,
          )
          return (
            <div className="topic-directory__row" key={topic.id}>
              <Link className="topic-directory__main" to={routes.boxRecords(topic.id)}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="topic-directory__text">
                  <strong>{topic.name}</strong>
                  <p>{records[0]?.content ?? '还没有记录，留一点想法在这里。'}</p>
                </span>
                <span className="topic-directory__count">{records.length} 条记录 →</span>
              </Link>
              <details className="topic-directory__menu">
                <summary aria-label={`管理主题${topic.name}`}>···</summary>
                <div>
                  <button
                    onClick={() => {
                      setEditing(topic.id)
                      setName(topic.name)
                      setError('')
                    }}
                  >
                    重命名
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !window.confirm(`删除“${topic.name}”后，记录会移回待整理，确定删除吗？`)
                      ) {
                        return
                      }
                      setBusy(true)
                      setError('')
                      try {
                        await papersActions.deleteTopic(topic.id)
                      } catch {
                        setError('删除失败，请重试')
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    删除主题
                  </button>
                </div>
              </details>
            </div>
          )
        })}
        {!state.topics.length && (
          <p>{state.syncing ? '正在加载主题…' : '还没有主题，点击右上角新建。'}</p>
        )}
      </div>
      <Link to={routes.inbox()}>
        待整理 · {state.papers.filter((paper) => !paper.topicId && !paper.deletedAt).length} 条记录
        →
      </Link>
    </section>
  )
}
