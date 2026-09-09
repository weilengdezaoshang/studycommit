import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useRecoverableDraft } from '@studycommit/common/paper-react'
import {
  PAPER_CONTENT_MAX_LENGTH,
  PAPER_QUESTION_MAX_LENGTH,
} from '@studycommit/common/paper-runtime'
import { routes } from '../../app/routes'
import { papersActions } from './papers-store'
import { createDesktopDraftStorage } from './draft-storage'

/** 接近正文上限时提前显示字数;与移动端预警线一致。 */
const CONTENT_WARNING_BUFFER = 2_000

const draftStorage = createDesktopDraftStorage()

/** 桌面 analog:窗口关闭/刷新前立即落盘,对齐移动端切后台语义。 */
function subscribeWindowHide(listener: (state: 'active' | 'background') => void): () => void {
  const handler = () => listener('background')
  window.addEventListener('beforeunload', handler)
  return () => window.removeEventListener('beforeunload', handler)
}

/**
 * 写记录(R68 + SH-305):顶部仅返回、标题和保存;正文优先;
 * 草稿防抖落盘本机,重进自动恢复;保存失败留页保留内容。
 */
export function ComposePage(): React.JSX.Element {
  const navigate = useNavigate()
  const draft = useRecoverableDraft({
    draftStorage,
    // 桌面直连创建暂无服务端幂等字段(与移动端离线队列同属待立项的协议项):
    // 锚点此处仅承载恢复语义,重试防重由保存按钮防抖与失败留页保证
    papers: { create: (input) => papersActions.createPaper(input) },
    createDraftId: () => crypto.randomUUID(),
    subscribeAppState: subscribeWindowHide,
  })
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const content = draft.draft?.content ?? ''
  const hasQuestion = draft.draft?.hasQuestion ?? false
  const questionText = draft.draft?.questionText ?? ''
  const nearLimit = content.length >= PAPER_CONTENT_MAX_LENGTH - CONTENT_WARNING_BUFFER
  const canSave = !draft.loading && !draft.saving && content.trim().length > 0

  const save = async () => {
    if (!canSave) {
      return
    }
    // 校验/创建失败时 Hook 记录 saveError,草稿保留供重试
    if (await draft.save()) {
      navigate(routes.timeline())
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
          {draft.saving ? '保存中' : '保存'}
        </button>
      </header>

      <div className="compose-page__sheet">
        <textarea
          className="compose-page__editor"
          value={content}
          onChange={(event) =>
            draft.dispatch({ type: 'setContent', content: event.target.value, now: Date.now() })
          }
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
        {draft.savedAt && (
          <p className="compose-page__counter" role="status">
            草稿已保留 ·{' '}
            {new Date(draft.savedAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {draft.recovered && (
          <p className="compose-page__hint" role="status">
            已恢复上次未保存的内容；保存成功后会自动清掉这份草稿。
          </p>
        )}

        <details className="compose-page__extras">
          <summary>添加来源、图片或疑问</summary>
          <label className="compose-page__question-toggle">
            <input
              type="checkbox"
              checked={hasQuestion}
              onChange={(event) =>
                draft.dispatch({
                  type: 'setQuestion',
                  hasQuestion: event.target.checked,
                  questionText,
                  now: Date.now(),
                })
              }
            />
            还有一个没弄懂的问题
          </label>
          {hasQuestion && (
            <>
              <textarea
                className="compose-page__question"
                value={questionText}
                maxLength={PAPER_QUESTION_MAX_LENGTH}
                onChange={(event) =>
                  draft.dispatch({
                    type: 'setQuestion',
                    hasQuestion: true,
                    questionText: event.target.value,
                    now: Date.now(),
                  })
                }
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

        {draft.saveError && (
          <p className="compose-page__error" role="alert">
            {draft.saveError}
          </p>
        )}
      </div>
    </section>
  )
}
