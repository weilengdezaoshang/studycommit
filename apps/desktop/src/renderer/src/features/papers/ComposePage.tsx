import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  PAPER_CONTENT_MAX_LENGTH,
  PAPER_QUESTION_MAX_LENGTH,
} from '@studycommit/common/paper-runtime'
import { routes } from '../../app/routes'
import { papersActions } from './papers-store'

/** 接近正文上限时提前显示字数;与移动端预警线一致。 */
const CONTENT_WARNING_BUFFER = 2_000

/**
 * 写记录(R68):顶部仅返回、标题和保存;正文优先;
 * 疑问按需展开;保存失败留页保留内容。
 */
export function ComposePage(): React.JSX.Element {
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [hasQuestion, setHasQuestion] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const trimmed = content.trim()
  const nearLimit = content.length >= PAPER_CONTENT_MAX_LENGTH - CONTENT_WARNING_BUFFER
  const canSave = trimmed.length > 0 && !saving

  const save = async () => {
    if (!canSave) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await papersActions.createPaper({
        content: trimmed,
        ...(hasQuestion && questionText.trim() ? { questionText: questionText.trim() } : {}),
      })
      navigate(routes.timeline())
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="compose-page" aria-label="写记录">
      <header className="compose-page__bar">
        <button type="button" className="compose-page__back" onClick={() => navigate(-1)}>
          返回
        </button>
        <h1 ref={titleRef} tabIndex={-1}>
          写记录
        </h1>
        <button
          type="button"
          className="compose-page__save"
          onClick={() => void save()}
          disabled={!canSave}
        >
          {saving ? '保存中' : '保存'}
        </button>
      </header>

      <div className="compose-page__sheet">
        <textarea
          className="compose-page__editor"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="记下一个想法…"
          aria-label="正文"
          autoFocus
        />
        {nearLimit && (
          <p
            className={`compose-page__counter${content.length >= PAPER_CONTENT_MAX_LENGTH ? ' is-over' : ''}`}
            role="status"
          >
            {content.length.toLocaleString()} / {PAPER_CONTENT_MAX_LENGTH.toLocaleString()}
          </p>
        )}

        <details className="compose-page__extras">
          <summary>添加来源、图片或疑问</summary>
          <label className="compose-page__question-toggle">
            <input
              type="checkbox"
              checked={hasQuestion}
              onChange={(event) => setHasQuestion(event.target.checked)}
            />
            还有一个没弄懂的问题
          </label>
          {hasQuestion && (
            <>
              <textarea
                className="compose-page__question"
                value={questionText}
                maxLength={PAPER_QUESTION_MAX_LENGTH}
                onChange={(event) => setQuestionText(event.target.value)}
                placeholder="把还没弄懂的部分写成一个问题"
                aria-label="这个问题"
              />
              <p className="compose-page__counter">
                {questionText.length.toLocaleString()} /{' '}
                {PAPER_QUESTION_MAX_LENGTH.toLocaleString()}
              </p>
            </>
          )}
          <p className="compose-page__hint">
            图片与截图在桌面端通过「截图学习」保存，此处暂不支持插入。
          </p>
        </details>

        {error && (
          <p className="compose-page__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
